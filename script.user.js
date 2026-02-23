// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.0
// @description  Herramientas para sistema WISP
// @author       Equipo
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("Wisp Tools cargado");

    // =========================
    // PANEL FLOTANTE
    // =========================
    const panel = document.createElement("div");
    panel.innerHTML = `
        <div id="wisp-panel">
            <div id="wisp-header">Wisp Tools</div>
            <button id="wisp-refresh">Refrescar datos</button>
            <button id="wisp-copy">Copiar cliente</button>
        </div>
    `;

    document.body.appendChild(panel);

    const style = document.createElement("style");
    style.innerHTML = `
        #wisp-panel {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e3a8a;
            color: white;
            padding: 12px;
            border-radius: 10px;
            z-index: 9999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            font-family: Arial;
            width: 160px;
        }

        #wisp-header {
            font-weight: bold;
            margin-bottom: 8px;
            text-align: center;
        }

        #wisp-panel button {
            width: 100%;
            margin-top: 5px;
            border: none;
            padding: 6px;
            border-radius: 6px;
            cursor: pointer;
        }

        #wisp-panel button:hover {
            background: #2563eb;
            color: white;
        }
    `;
    document.head.appendChild(style);

    // =========================
    // BOTONES
    // =========================

    document.getElementById("wisp-refresh").onclick = () => {
        location.reload();
    };

    document.getElementById("wisp-copy").onclick = () => {
        const text = window.getSelection().toString();
        if (text) {
            navigator.clipboard.writeText(text);
            alert("Copiado: " + text);
        } else {
            alert("Selecciona un nombre o texto primero.");
        }
    };

})();
