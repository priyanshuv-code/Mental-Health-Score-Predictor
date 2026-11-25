
/* =========================================
   MENTAL HEALTH PREDICTION PROJECT
   Vanilla JavaScript + FastAPI
========================================= */

(() => {
  'use strict';

  const API_URL = 'https://mental-health-score-predictor-kfu0.onrender.com';

  // HTML elements
  const form = document.getElementById('predict-form');
  const submitButton = document.getElementById('submit-btn');
  const resetButton = document.getElementById('reset-btn');
  const retryButton = document.getElementById('error-retry-btn');

  const stressGroup = document.getElementById('stress_level_group');
  const stressInput = document.getElementById('stress_level');

  const states = {
    idle: document.getElementById('state-idle'),
    loading: document.getElementById('state-loading'),
    result: document.getElementById('state-result'),
    error: document.getElementById('state-error')
  };

  const scoreNumber = document.getElementById('score-number');
  const scoreBand = document.getElementById('score-band');
  const scoreContext = document.getElementById('score-context');
  const gaugeFill = document.getElementById('gauge-fill');
  const errorCopy = document.getElementById('error-copy');

  // All 12 fields
  const fields = [
    { id: 'age', type: 'integer', min: 10, max: 100, label: 'Age' },
    { id: 'gender', type: 'select', label: 'Gender' },
    { id: 'country', type: 'text', label: 'Country' },
    { id: 'academic_level', type: 'select', label: 'Academic level' },
    { id: 'most_used_platform', type: 'select', label: 'Most-used platform' },
    { id: 'purpose_of_use', type: 'select', label: 'Primary purpose' },
    { id: 'avg_daily_usage_hours', type: 'number', min: 0, max: 24, label: 'Screen time' },
    { id: 'daily_unlocks', type: 'integer', min: 0, label: 'Daily unlocks' },
    { id: 'study_hours', type: 'number', min: 0, max: 24, label: 'Study hours' },
    { id: 'physical_activity_hours', type: 'number', min: 0, max: 24, label: 'Physical activity' },
    { id: 'sleep_hours_per_night', type: 'number', min: 0, max: 24, label: 'Sleep hours' },
    { id: 'stress_level', type: 'stress', label: 'Stress level' }
  ];

  // Show the required dashboard state
  function showState(stateName) {
    Object.entries(states).forEach(([name, element]) => {
      element.hidden = name !== stateName;
    });
  }

  // Loading button
  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle('is-loading', isLoading);

    const label = submitButton.querySelector('.btn-label');

    if (label) {
      label.textContent = isLoading
        ? 'Analyzing your signal…'
        : 'Read my signal';
    }

    submitButton.setAttribute('aria-busy', String(isLoading));
  }

  // Display field validation errors
  function showFieldError(id, message) {
    const input = document.getElementById(id);

    const error = document.querySelector(
      `.error-msg[data-for="${id}"]`
    );

    const field = input?.closest('.field');

    if (error) {
      error.textContent = message || '';
    }

    if (field) {
      field.classList.toggle('has-error', Boolean(message));
    }

    if (input) {
      input.setAttribute(
        'aria-invalid',
        String(Boolean(message))
      );
    }
  }

  // Clear validation errors
  function clearErrors() {
    fields.forEach(({ id }) => {
      showFieldError(id, '');
    });
  }

  // Validate and collect all form values
  function validateAndCollect() {
    clearErrors();

    const payload = {};
    let firstInvalid = null;

    fields.forEach((field) => {
      const element = document.getElementById(field.id);

      if (!element) return;

      const rawValue = element.value.trim();
      let error = '';

      if (!rawValue) {
        error = `Please enter or select ${field.label.toLowerCase()}.`;
      }

      else if (
        field.type === 'number' ||
        field.type === 'integer'
      ) {
        const value = Number(rawValue);

        if (!Number.isFinite(value)) {
          error = `${field.label} must be a valid number.`;
        }

        else if (
          field.type === 'integer' &&
          !Number.isInteger(value)
        ) {
          error = `${field.label} must be a whole number.`;
        }

        else if (
          field.min !== undefined &&
          value < field.min
        ) {
          error = `${field.label} must be at least ${field.min}.`;
        }

        else if (
          field.max !== undefined &&
          value > field.max
        ) {
          error = `${field.label} must be no more than ${field.max}.`;
        }

        else {
          payload[field.id] = value;
        }
      }

      else {
        payload[field.id] = rawValue;
      }

      if (error) {
        showFieldError(field.id, error);

        if (!firstInvalid) {
          firstInvalid = element;
        }
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return payload;
  }

  // Update animated prediction gauge
  function setGauge(score) {
    const safeScore = Math.max(0, Math.min(10, score));

    const circumference = 314.16;

    const offset =
      circumference * (1 - safeScore / 10);

    if (gaugeFill) {
      gaugeFill.style.strokeDasharray =
        String(circumference);

      gaugeFill.style.strokeDashoffset =
        String(circumference);

      requestAnimationFrame(() => {
        gaugeFill.style.strokeDashoffset =
          String(offset);
      });
    }
  }

  // Score description
  function describeScore(score) {
    if (score < 4) {
      return {
        label: 'Lower model score',
        message:
          'The model returned a value in the lower part of its 0–10 score range. This is an estimate, not a mental-health diagnosis.'
      };
    }

    if (score < 7) {
      return {
        label: 'Mid-range model score',
        message:
          'The model returned a value in the middle part of its 0–10 score range. Consider the result alongside your own experience and wellbeing.'
      };
    }

    return {
      label: 'Higher model score',
      message:
        'The model returned a value in the upper part of its 0–10 score range. This estimate does not determine your mental-health status.'
    };
  }

  // Display successful prediction
  function showResult(score) {
    if (!Number.isFinite(score)) {
      showError('Invalid prediction score received from server.');
      return;
    }

    const details = describeScore(score);

    scoreNumber.textContent = score.toFixed(2);
    scoreBand.textContent = details.label;
    scoreContext.textContent = details.message;

    showState('result');

    setGauge(score);
  }

  // Handle FastAPI errors
  function formatApiError(data, status) {
    if (data && Array.isArray(data.detail)) {
      return data.detail.map((item) => {
        const field = Array.isArray(item.loc)
          ? item.loc[item.loc.length - 1]
          : 'input';

        return `${field}: ${item.msg}`;
      }).join(' ');
    }

    if (data && typeof data.detail === 'string') {
      return data.detail;
    }

    if (data && typeof data.message === 'string') {
      return data.message;
    }

    return `Server error (HTTP ${status}). Please try again.`;
  }

  // Display error dashboard
  function showError(message) {
    errorCopy.textContent = message;
    showState('error');
  }

  // Reset prediction result
  function resetPrediction() {
    showState('idle');

    setGauge(0);

    clearErrors();

    const firstInput = document.getElementById('age');

    if (firstInput) {
      firstInput.focus({ preventScroll: true });
    }
  }

  // Stress-level segmented buttons
  if (stressGroup && stressInput) {
    stressGroup.querySelectorAll('.seg-btn').forEach((button) => {

      button.setAttribute('aria-pressed', 'false');

      button.addEventListener('click', () => {

        const selectedValue = button.dataset.value;

        stressInput.value = selectedValue;

        stressGroup.querySelectorAll('.seg-btn').forEach((item) => {

          const selected = item === button;

          item.classList.toggle('active', selected);

          item.setAttribute(
            'aria-pressed',
            String(selected)
          );
        });

        showFieldError('stress_level', '');
      });
    });
  }

  // Clear errors when user changes an input
  fields.forEach(({ id }) => {
    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener('input', () => {
      showFieldError(id, '');
    });

    element.addEventListener('change', () => {
      showFieldError(id, '');
    });
  });

  // Main form submission
  form.addEventListener('submit', async (event) => {

    event.preventDefault();

    // Validate all 12 fields
    const payload = validateAndCollect();

    if (!payload) return;

    // Start loading
    setLoading(true);

    showState('loading');

    try {

      // Send data to FastAPI
      const response = await fetch(API_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(payload)
      });

      let responseData = {};

      try {
        responseData = await response.json();
      }

      catch {
        throw new Error(
          `Invalid server response (HTTP ${response.status}).`
        );
      }

      // Handle HTTP errors
      if (!response.ok) {
        throw new Error(
          formatApiError(responseData, response.status)
        );
      }

      // Check prediction response
      if (
        !Object.prototype.hasOwnProperty.call(
          responseData,
          'predicted_mental_health_score'
        )
      ) {
        throw new Error(
          'Prediction score was not found in API response.'
        );
      }

      const score = Number(
        responseData.predicted_mental_health_score
      );

      // Display prediction
      showResult(score);

    }

    catch (error) {

      console.error('Prediction Error:', error);

      const message = error instanceof TypeError
        ? 'Cannot connect to FastAPI. Make sure your backend is running at http://127.0.0.1:2200.'
        : error.message || 'Something went wrong. Please try again.';

      showError(message);

    }

    finally {

      // Restore submit button
      setLoading(false);

    }
  });

  // Run another prediction
  if (resetButton) {
    resetButton.addEventListener(
      'click',
      resetPrediction
    );
  }

  // Retry after error
  if (retryButton) {
    retryButton.addEventListener('click', () => {

      showState('idle');

      const firstMissing = fields
        .map(({ id }) => document.getElementById(id))
        .find((element) => element && !element.value.trim());

      if (firstMissing) {
        firstMissing.focus();
      } else {
        submitButton.focus();
      }
    });
  }

  // Generate SVG gauge tick marks
  document.querySelectorAll('.gauge-ticks').forEach((group) => {

    const centerX = 120;
    const centerY = 140;
    const radius = 100;

    for (let index = 0; index <= 10; index++) {

      const angle =
        Math.PI + (Math.PI * index / 10);

      const innerRadius = radius - 8;
      const outerRadius = radius - 2;

      const x1 =
        centerX + Math.cos(angle) * innerRadius;

      const y1 =
        centerY + Math.sin(angle) * innerRadius;

      const x2 =
        centerX + Math.cos(angle) * outerRadius;

      const y2 =
        centerY + Math.sin(angle) * outerRadius;

      const tick = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
      );

      tick.setAttribute('x1', x1.toFixed(2));
      tick.setAttribute('y1', y1.toFixed(2));
      tick.setAttribute('x2', x2.toFixed(2));
      tick.setAttribute('y2', y2.toFixed(2));

      group.appendChild(tick);
    }
  });

})();
