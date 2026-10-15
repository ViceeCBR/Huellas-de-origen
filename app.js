document.addEventListener("DOMContentLoaded", () => {
  // Elementos DOM
  const video = document.getElementById("camera");
  const canvas = document.getElementById("workshop");
  const ctx = canvas.getContext("2d");
  const btnToggleCam = document.getElementById("btn-toggle-cam");
  const cameraOverlay = document.getElementById("camera-overlay");
  const statusIndicator = document.getElementById("status-indicator");
  const noticeMsg = document.getElementById("notice-msg");

  let isCameraActive = false;
  let cameraInstance = null;

  // Estado del cursor y gestos
  let cursorPos = { x: canvas.width / 2, y: canvas.height / 2 };
  let isPinching = false;
  let activeColor = "#3e8e5b"; // Color predeterminado para estampar
  let stamps = []; // Arreglo de estampas realizadas

  // Botones flotantes interactivos sobre el Canvas
  const canvasButtons = [
    { id: "green", label: "Verde", x: 40, y: 30, w: 120, h: 45, color: "#3e8e5b" },
    { id: "orange", label: "Naranja", x: 180, y: 30, w: 120, h: 45, color: "#d97706" },
    { id: "purple", label: "Morado", x: 320, y: 30, w: 120, h: 45, color: "#7c3aed" },
    { id: "clear", label: "Limpiar", x: 1120, y: 30, w: 120, h: 45, color: "#dc2626" }
  ];

  // Configuración de MediaPipe Hands
  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65
  });

  hands.onResults(processHandData);

  // Procesa cada frame de MediaPipe
  function processHandData(results) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dibujar el video de fondo en espejo
    if (results.image) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // 2. Dibujar las estampas previamente realizadas
    stamps.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // 3. Dibujar botones sobre el canvas
    drawCanvasUI();

    // 4. Si se detecta la mano, procesar cursor y gestos
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];

      // Punto 8: Índice | Punto 4: Pulgar
      const indexFinger = landmarks[8];
      const thumb = landmarks[4];

      // Coordenadas con inversión horizontal (modo espejo)
      cursorPos.x = (1 - indexFinger.x) * canvas.width;
      cursorPos.y = indexFinger.y * canvas.height;

      // Calcular distancia euclidiana entre índice y pulgar
      const dx = (indexFinger.x - thumb.x) * canvas.width;
      const dy = (indexFinger.y - thumb.y) * canvas.height;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Umbral para considerar que la mano está cerrada (Cierre / Pellizco)
      const PINCH_THRESHOLD = 40;
      const currentlyPinching = distance < PINCH_THRESHOLD;

      // Disparar acción solo al INICIO del pellizco (efecto click)
      if (currentlyPinching && !isPinching) {
        handleCanvasClick(cursorPos.x, cursorPos.y);
      }

      isPinching = currentlyPinching;

      // Dibujar punto entre los dedos
      ctx.beginPath();
      ctx.arc((1 - thumb.x) * canvas.width, thumb.y * canvas.height, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Dibujar Cursor Virtual
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, isPinching ? 10 : 16, 0, Math.PI * 2);
      ctx.fillStyle = isPinching ? "#ffffff" : activeColor;
      ctx.fill();
      ctx.strokeStyle = "#273448";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Dibuja los botones de la interfaz flotante
  function drawCanvasUI() {
    canvasButtons.forEach((btn) => {
      const isHovered =
        cursorPos.x >= btn.x &&
        cursorPos.x <= btn.x + btn.w &&
        cursorPos.y >= btn.y &&
        cursorPos.y <= btn.y + btn.h;

      ctx.fillStyle = btn.color;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 8);
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    });
  }

  // Lógica de detección de clicks sobre botones o lienzo
  function handleCanvasClick(x, y) {
    let hitButton = false;

    canvasButtons.forEach((btn) => {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        hitButton = true;
        if (btn.id === "clear") {
          stamps = [];
          noticeMsg.textContent = "Lienzo limpiado.";
        } else {
          activeColor = btn.color;
          noticeMsg.textContent = `Color cambiado a: ${btn.label}`;
        }
      }
    });

    // Si no se tocó ningún botón, estampar en el área de dibujo
    if (!hitButton) {
      stamps.push({ x, y, color: activeColor });
      noticeMsg.textContent = `Estampa colocada en (${Math.round(x)}, ${Math.round(y)})`;
    }
  }

  // Activar o desactivar transmisión y seguimiento
  async function toggleCamera() {
    if (isCameraActive) {
      if (cameraInstance) await cameraInstance.stop();
      isCameraActive = false;
      cameraOverlay.classList.remove("hidden");
      statusIndicator.classList.remove("live");
      statusIndicator.textContent = "Desconectado";
      btnToggleCam.textContent = "Activar Cámara";
      noticeMsg.textContent = "Cámara detenida.";
    } else {
      noticeMsg.textContent = "Cargando modelo de MediaPipe...";

      cameraInstance = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
        },
        width: 1280,
        height: 720
      });

      await cameraInstance.start();
      isCameraActive = true;
      cameraOverlay.classList.add("hidden");
      statusIndicator.classList.add("live");
      statusIndicator.textContent = "EN VIVO";
      btnToggleCam.textContent = "Detener Cámara";
      noticeMsg.textContent = "Mano detectada. Junta índice y pulgar para interactuar.";
    }
  }

  btnToggleCam.addEventListener("click", toggleCamera);

  // Atajo de teclado para limpiar
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") {
      stamps = [];
      noticeMsg.textContent = "Lienzo limpiado.";
    }
  });
});