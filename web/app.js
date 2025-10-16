const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const labelEl = null;
const imageEl = document.getElementById('gesture_image');

const GESTURE_IMAGES = {
  seria: '/img/seria.png',
  pensando: '/img/pensando.png',
  acertado: '/img/acertado.png',
  asustado: '/img/asustado.png'
};

const CONFIG = {
  mouthOpenRatio: 0.055, // distancia entre labios vs ancho de la cara
  indexNearLipPx: 50, // distancia en píxeles del dedo índice a los labios
  indexUpAngleDeg: 60, // angulo mínimo del vector del índice hacia arriba
  smoothFrames: 3 // numero de frames para estabilizar gesto
};

let lastGestures = [];
function setGesture(name) {
  lastGestures.push(name);
  if (lastGestures.length > CONFIG.smoothFrames) lastGestures.shift();
  const stable = lastGestures.every(g => g === name);
  if (stable) {
    imageEl.src = GESTURE_IMAGES[name] || '';
  }
}

function getLipCenter(faceLandmarks, vw, vh) {

  const upper = faceLandmarks[13];
  const lower = faceLandmarks[14];
  if (!upper || !lower) return null;
  return {
    x: ((upper.x + lower.x) / 2) * vw,
    y: ((upper.y + lower.y) / 2) * vh
  };
}

function getMouthOpenRatio(faceLandmarks, vw, vh) {
  const upper = faceLandmarks[13];
  const lower = faceLandmarks[14];
  const left = faceLandmarks[61];
  const right = faceLandmarks[291];
  if (!upper || !lower || !left || !right) return 0;
  const mouthOpen = Math.hypot((upper.x - lower.x) * vw, (upper.y - lower.y) * vh);
  const mouthWidth = Math.hypot((left.x - right.x) * vw, (left.y - right.y) * vh);
  return mouthWidth > 0 ? mouthOpen / mouthWidth : 0;
}

function detectGesture(results) {
  const vw = canvasElement.width;
  const vh = canvasElement.height;

  const faceLandmarks = results.faceLandmarks?.[0];
  const handLandmarksList = results.multiHandLandmarks || [];

  // pensativo mmm
  if (faceLandmarks && handLandmarksList.length) {
    const lipCenter = getLipCenter(faceLandmarks, vw, vh);
    if (lipCenter) {
      for (const hand of handLandmarksList) {
        const indexTip = hand[8]; 
        if (indexTip) {
          const ix = indexTip.x * vw;
          const iy = indexTip.y * vh;
          const d = Math.hypot(ix - lipCenter.x, iy - lipCenter.y);
          if (d < CONFIG.indexNearLipPx) return 'pensando';
        }
      }
    }
  }

  // le achunto
  if (handLandmarksList.length) {
    for (const hand of handLandmarksList) {
      const base = hand[5];
      const tip = hand[8];
      if (base && tip) {
        const vx = (tip.x - base.x) * vw;
        const vy = (tip.y - base.y) * vh;
        const angleDeg = (Math.atan2(-vy, vx) * 180) / Math.PI; 
        const upAngle = Math.abs(90 - Math.abs(angleDeg));
        if (upAngle < (90 - CONFIG.indexUpAngleDeg)) {
          return 'acertado';
        }
      }
    }
  }

  // aaaa me asuste
  if (faceLandmarks) {
    const ratio = getMouthOpenRatio(faceLandmarks, vw, vh);
    if (ratio > CONFIG.mouthOpenRatio) return 'asustado';
  }

  // mmmmm
  return 'seria';
}

function onResults(results) {
  if (videoElement.videoWidth && videoElement.videoHeight) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  canvasCtx.restore();

  const gesture = detectGesture(results);
  setGesture(gesture);
}

async function main() {

  const faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  const hands = new Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  faceMesh.onResults((res) => {
    latest.face = res;
  });
  hands.onResults((res) => {
    latest.hands = res;
  });

  const latest = { face: null, hands: null };

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
      await hands.send({ image: videoElement });

      const results = {
        image: videoElement,
        faceLandmarks: latest.face?.multiFaceLandmarks || latest.face?.faceLandmarks || [],
        multiHandLandmarks: latest.hands?.multiHandLandmarks || []
      };
      onResults(results);
    },
    width: 640,
    height: 480
  });

  try {
    await camera.start();
  } catch (err) {
    console.error(err);
  }
}

main();
