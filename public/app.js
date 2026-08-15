const settings = {
  authorization: {
    title: "🔐 Authorization",
    fields: [
      ["Username", "text"],
      ["Password", "password"]
    ]
  },

  stream: {
    title: "📡 Stream",
    fields: [
      ["Service", "select", ["YouTube", "Facebook", "Twitch", "Kick", "Custom"]],
      ["Server", "text"],
      ["Stream Key", "password"]
    ]
  },

  output: {
    title: "🎬 Output",
    fields: [
      ["Encoder", "select", ["H.264", "H.265", "AV1"]],
      ["Rate Control", "select", ["CBR", "VBR", "CQP"]],
      ["Bitrate", "number"],
      ["Keyframe Interval", "number"],
      ["Preset", "select", ["Very Fast", "Fast", "Medium", "Slow"]],
      ["Profile", "select", ["Main", "High"]],
      ["Tune", "select", ["None", "Film", "Animation"]]
    ]
  },

  audio: {
    title: "🔊 Audio",
    fields: [
      ["Encoder", "select", ["AAC", "Opus"]],
      ["Bitrate", "number"],
      ["Sample Rate", "select", ["44.1 kHz", "48 kHz"]],
      ["Channels", "select", ["Mono", "Stereo"]]
    ]
  },

  video: {
    title: "🎥 Video",
    fields: [
      [
        "Base Resolution (Canvas)",
        "select",
        ["1920×1080", "1280×720", "852×480", "640×360", "Custom"]
      ],
      [
        "Output Resolution (Scaled)",
        "select",
        ["1920×1080", "1280×720", "852×480", "640×360", "Custom"]
      ],
      [
        "FPS Values",
        "select",
        ["10", "20", "24 NTSC", "25", "29.97", "30", "48", "59.94", "60"]
      ]
    ]
  },

  advanced: {
    title: "⚙ Advanced",
    fields: [
      ["Automatically Reconnect", "checkbox"],
      ["Network", "text"]
    ]
  }
};

const editorPage = document.getElementById("editorPage");
const settingsPage = document.getElementById("settingsPage");
const settingsTitle = document.getElementById("settingsTitle");
const settingsContent = document.getElementById("settingsContent");

function showEditor() {
  editorPage.classList.add("active");
  settingsPage.classList.remove("active");

  document
    .querySelectorAll(".nav-item")
    .forEach(button => button.classList.remove("active"));

  document
    .querySelector(".nav-item")
    .classList.add("active");
}

function showSettings(name) {
  const setting = settings[name];

  if (!setting) return;

  editorPage.classList.remove("active");
  settingsPage.classList.add("active");

  settingsTitle.textContent = setting.title;

  settingsContent.innerHTML = setting.fields
    .map(([label, type, options]) => {
      if (type === "checkbox") {
        return `
          <div class="form-row">
            <label>
              <input type="checkbox">
              ${label}
            </label>
          </div>
        `;
      }

      if (type === "select") {
        return `
          <div class="form-row">
            <label>${label}</label>
            <select>
              ${options.map(option =>
                `<option>${option}</option>`
              ).join("")}
            </select>
          </div>
        `;
      }

      return `
        <div class="form-row">
          <label>${label}</label>
          <input type="${type}">
        </div>
      `;
    })
    .join("") + `
      <div class="form-actions">
        <button>Cancel</button>
        <button class="save">Save</button>
      </div>
    `;
}

document.querySelector(".nav-item").addEventListener("click", showEditor);

document.querySelectorAll(".settings-nav button").forEach(button => {
  button.addEventListener("click", () => {
    showSettings(button.dataset.page);
  });
});

document.getElementById("menuButton").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("hidden");
});

const volume = document.getElementById("volume");
const volumeValue = document.getElementById("volumeValue");

volume.addEventListener("input", () => {
  volumeValue.textContent = `${volume.value}%`;
});

let streaming = false;

document.getElementById("startButton").addEventListener("click", () => {
  streaming = true;

  const status = document.getElementById("status");

  status.textContent = "● LIVE";
  status.className = "online";
  status.style.color = "#20c878";
});

document.getElementById("stopButton").addEventListener("click", () => {
  streaming = false;

  const status = document.getElementById("status");

  status.textContent = "● Offline";
  status.className = "offline";
});

async function updateUsage() {
  try {
    const response = await fetch("/api/status");

    if (!response.ok) return;

    const data = await response.json();

    document.getElementById("uptime").textContent = data.uptime;
    document.getElementById("bitrate").textContent =
      `${data.bitrate} kbit/s`;
    document.getElementById("fps").textContent = data.fps;
    document.getElementById("cpu").textContent = `${data.cpu}%`;
    document.getElementById("ram").textContent = `${data.ram}%`;
  } catch {
    // Server unavailable.
  }
}

setInterval(updateUsage, 2000);
updateUsage();
