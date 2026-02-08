const receipt = document.querySelector('.receipt');
const note = document.querySelector('.note');
const reset = document.querySelector('.reset');
const options = document.querySelectorAll('.option');
const cursor = document.querySelector('.hand-cursor');
const tracker = document.querySelector('.tracker');
const videoElement = document.querySelector('.input-video');
const canvasElement = document.querySelector('.output-canvas');
const canvasCtx = canvasElement.getContext('2d');

const notes = [
  'The moka pot is taking a nap.',
  'That pot is feeling shy today.',
  'The moka pot says: maybe espresso?',
];

let noteIndex = 0;
let lastHover = null;
let lastPinch = false;
let pinchLatch = false;
let smoothX = window.innerWidth / 2;
let smoothY = window.innerHeight / 2;

function showNote(message, duration = 2000) {
  note.textContent = message;
  note.classList.add('show');
  setTimeout(() => note.classList.remove('show'), duration);
}

options.forEach((option) => {
  option.addEventListener('click', () => {
    const choice = option.dataset.choice;
    if (choice === 'yes') {
      receipt.classList.add('active');
      showNote('Brewing something special...');
    } else {
      option.classList.remove('shake');
      void option.offsetWidth;
      option.classList.add('shake');
      showNote(notes[noteIndex % notes.length]);
      noteIndex += 1;
    }
  });
});

const noButton = document.querySelector('.option.no .cta');
noButton.addEventListener('mouseenter', () => {
  showNote(
    'The audacity to try and click here, you think no was ever an option?',
    2500
  );
});

reset.addEventListener('click', () => {
  receipt.classList.remove('active');
});

function setHover(target) {
  if (lastHover && lastHover !== target) {
    lastHover.classList.remove('hand-hover');
  }
  if (target) {
    target.classList.add('hand-hover');
  }
  lastHover = target;
}

function pulseClick(target) {
  if (!target) return;
  target.classList.add('hand-click');
  setTimeout(() => target.classList.remove('hand-click'), 150);
}

function getClickableTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.classList.contains('cta')) return el;
  return el.closest('.option');
}

function updateCursor(x, y, pinched) {
  smoothX += (x - smoothX) * 0.35;
  smoothY += (y - smoothY) * 0.35;
  cursor.style.left = `${smoothX}px`;
  cursor.style.top = `${smoothY}px`;
  cursor.classList.toggle('active', true);
  cursor.classList.toggle('pinch', pinched);

  const target = getClickableTarget(smoothX, smoothY);
  setHover(target);

  if (pinched && !lastPinch && target) {
    pulseClick(target);
    target.click();
  }
  lastPinch = pinched;
}

function drawHandLandmarks(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.multiHandLandmarks?.length) {
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#f4e7d5', lineWidth: 2 });
      drawLandmarks(canvasCtx, landmarks, { color: '#c38b5f', lineWidth: 1 });
    }
  } else {
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  }
  canvasCtx.restore();
}

async function initHands() {
  if (!navigator.mediaDevices?.getUserMedia) return;

  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults((results) => {
    if (!results.multiHandLandmarks?.length) {
      drawHandLandmarks(results);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];

    const pinchDistance = Math.hypot(
      indexTip.x - thumbTip.x,
      indexTip.y - thumbTip.y
    );
    const pinchStart = 0.045;
    const pinchEnd = 0.06;

    if (!pinchLatch && pinchDistance < pinchStart) pinchLatch = true;
    if (pinchLatch && pinchDistance > pinchEnd) pinchLatch = false;
    const isPinched = pinchLatch;

    const x = indexTip.x * window.innerWidth;
    const y = indexTip.y * window.innerHeight;

    updateCursor(x, y, isPinched);
    drawHandLandmarks(results);
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({ image: videoElement });
    },
    width: 480,
    height: 360,
  });

  tracker.setAttribute('aria-hidden', 'false');
  await camera.start();
}

initHands();
