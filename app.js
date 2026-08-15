const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/* --------------------------------
   Navigation
-------------------------------- */

const sidebar = $("#sidebar");
const menuBtn = $("#menuBtn");

menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".nav-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

/* --------------------------------
   Preview
-------------------------------- */

const previewEnabled = $("#previewEnabled");
const previewCanvas = $("#previewCanvas");

previewEnabled.addEventListener("change", () => {
  previewCanvas.style.opacity = previewEnabled.checked ? "1" : "0.25";
});

/* --------------------------------
   Volume
-------------------------------- */

const volume = $("#volume");
const volumeValue = $("#volumeValue");

volume.addEventListener("input", () => {
  volumeValue.textContent = `${volume.value}%`;
});

const muteBtn = $("#muteBtn");
let muted = false;

muteBtn.addEventListener("click", () => {
  muted = !muted;

  if (muted) {
    muteBtn.textContent = "🔊 Unmute";
    volumeValue.textContent = "Muted";
  } else {
    muteBtn.textContent = "🔇 Mute";
    volumeValue.textContent = `${volume.value}%`;
  }
});

/* --------------------------------
   Scenes
-------------------------------- */

const sceneList = $("#sceneList");
const addScene = $("#addScene");
const removeScene = $("#removeScene");

let sceneNumber = 2;

function selectScene(button) {
  $$(".list-item").forEach((item) => item.classList.remove("selected"));
  button.classList.add("selected");
}

sceneList.addEventListener("click", (event) => {
  if (event.target.classList.contains("list-item")) {
    selectScene(event.target);
  }
});

addScene.addEventListener("click", () => {
  sceneNumber++;

  const scene = document.createElement("button");
  scene.className = "list-item";
  scene.textContent = `Scene ${sceneNumber}`;

  scene.addEventListener("click", () => selectScene(scene));

  sceneList.appendChild(scene);
});

removeScene.addEventListener("click", () => {
  const selected = sceneList.querySelector(".selected");

  if (!selected) return;

  if (sceneList.children.length <= 1) {
    alert("At least one scene is required.");
    return;
  }

  selected.remove();

  sceneList.firstElementChild.classList.add("selected");
});

/* --------------------------------
   Source Dialog
-------------------------------- */

const sourceDialog = $("#sourceDialog");
const addSource = $("#addSource");

addSource.addEventListener("click", () => {
  sourceDialog.showModal();
});

$$(".close-dialog").forEach((button) => {
  button.addEventListener("click", () => {
    sourceDialog.close();
  });
});

$$("[data-source]").forEach((button) => {
  button.addEventListener("click", () => {
    const sourceType = button.dataset.source;

    sourceDialog.close();

    alert(
      `${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} Source configuration opened.`
    );
  });
});

$("#removeSource").addEventListener("click", () => {
  const checked = [...$$(".source-item input:checked")];

  if (!checked.length) {
    alert("Select a source to remove.");
    return;
  }

  if (confirm("Remove the selected source(s) from this scene?")) {
    checked.forEach((checkbox) => {
      checkbox.closest(".source-item").remove();
    });
  }
});

/* --------------------------------
   Streaming Controls
-------------------------------- */

const startStreaming = $("#startStreaming");
const stopStreaming = $("#stopStreaming");
const status = $("#status");

let streaming = false;
let streamStartedAt = null;

startStreaming.addEventListener("click", () => {
  if (streaming) return;

  streaming = true;
  streamStartedAt = Date.now();

  status.textContent = "● Live";
  status.className = "status online";

  startStreaming.disabled = true;
  stopStreaming.disabled = false;
});

stopStreaming.addEventListener("click", () => {
  if (!streaming) return;

  streaming = false;
  streamStartedAt = null;

  status.textContent = "● Offline";
  status.className = "status offline";

  startStreaming.disabled = false;
  stopStreaming.disabled = false;
});

/* --------------------------------
   Uptime
-------------------------------- */

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0"),
  ].join(":");
}

setInterval(() => {
  const uptime = $("#uptime");

  if (!streaming || !streamStartedAt) {
    uptime.textContent = "00:00:00";
    return;
  }

  const seconds = Math.floor((Date.now() - streamStartedAt) / 1000);
  uptime.textContent = formatTime(seconds);
}, 1000);

/* --------------------------------
   Simulated System Usage
-------------------------------- */

setInterval(() => {
  $("#cpu").textContent = `${Math.floor(8 + Math.random() * 12)}%`;
  $("#ram").textContent = `${Math.floor(34 + Math.random() * 8)}%`;
}, 2000);

/* --------------------------------
   Settings
-------------------------------- */

const settingsDialog = $("#settingsDialog");
const settingsTitle = $("#settingsTitle");

function openSettings(setting) {
  settingsTitle.textContent =
    setting.charAt(0).toUpperCase() + setting.slice(1);

  $$(".setting-content").forEach((content) => {
    content.classList.toggle(
      "active",
      content.dataset.settingContent === setting
    );
  });

  settingsDialog.showModal();
}

$$("[data-setting]").forEach((button) => {
  button.addEventListener("click", () => {
    openSettings(button.dataset.setting);
  });
});

$$(".close-settings").forEach((button) => {
  button.addEventListener("click", () => {
    settingsDialog.close();
  });
});

$("#settingsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  settingsDialog.close();

  alert("Settings saved.");
});

/* --------------------------------
   Properties
-------------------------------- */

$("#sourceProperties").addEventListener("click", () => {
  alert("Source properties panel.");
});

$("#audioProperties").addEventListener("click", () => {
  alert("Audio properties panel.");
});

/* --------------------------------
   Platforms
-------------------------------- */

$("#addPlatform").addEventListener("click", () => {
  alert("Add Platform: YouTube, Facebook, Twitch, Kick, Custom");
});

$("#removePlatform").addEventListener("click", () => {
  alert("Select a platform to remove.");
});

/* --------------------------------
   User Menu
-------------------------------- */

$("#userMenu").addEventListener("click", () => {
  alert("User menu");
});
