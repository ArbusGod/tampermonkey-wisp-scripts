// ==UserScript==
// @name         Wisp Tools
// @namespace    wisp-tools
// @version      1.0.1
// @description  Herramientas para sistema WISP
// @author       Equipo
// @match        *://*/wispcontrol/tech/*
// @match        *://*/wispcontrol/*
// @match        *://*/wispro/*
// @match        *://*/fact_fichacli*
// @updateURL    https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/ArbusGod/tampermonkey-wisp-scripts/main/script.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("Wisp Tools cargado");

    // =========================
    // PANEL FLOTANTE (se queda igual)
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
    // >>> CONFIGURACIÓN DE "LLENOS" (EDITAR AQUÍ)
    // =========================

    // >>> AQUÍ AÑADE LOS PUERTOS PON LLENOS <<<
    // Formato: "frame/slot/port" (ej: "0/1/13")
    const FULL_PONS = new Set([
        "0/1/13", // Ejemplo: PON lleno (0/1/13)
        // "0/1/14",
        // "0/2/5",
    ]);

    // >>> AQUÍ AÑADE LAS CAJAS LLENAS <<<
    // Se compara por "nombre base" (por ejemplo "SAVI 101"), sin importar los "(7)" u otros sufijos.
    const FULL_BOX_BASE_NAMES = new Set([
        "SAVI 101", // Ejemplo: caja llena
        // "LOGU 108",
        // "CABA 902",
    ]);

    // =========================
    // DETECCIÓN Y ADVERTENCIAS
    // =========================

    // Para evitar repetir alertas idénticas en la misma página
    const warnedKeys = new Set();

    function todayISO() {
        // Fecha local en formato YYYY-MM-DD
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function readPon() {
        const frame = (document.getElementById("frame_fiber_register")?.value ?? "").trim();
        const slot = (document.getElementById("slot_fiber_register")?.value ?? "").trim();
        const port = (document.getElementById("port_fiber_register")?.value ?? "").trim();

        // Según tu caso, siempre habrá datos. Igual, si alguno falta, no avisamos.
        if (!frame || !slot || !port) return "";
        return `${frame}/${slot}/${port}`;
    }

    function readBoxText() {
        // 1) Intentar desde el select real
        const sel = document.getElementById("select_box");
        if (sel && sel.selectedIndex >= 0) {
            const txt = (sel.options[sel.selectedIndex]?.textContent || "").trim();
            if (txt) return txt;
        }

        // 2) Fallback para "uniform" (tu HTML muestra el texto aquí)
        const spanTxt = (document.querySelector("#uniform-select_box span")?.textContent || "").trim();
        return spanTxt;
    }

    function normalizeBoxBaseName(boxText) {
        // De "SAVI 101 (7)" -> "SAVI 101"
        // De "LOGU 105 (1x8) (0)" -> "LOGU 105"
        // Si no matchea, devolvemos el texto original.
        const m = boxText.match(/^\s*([A-ZÑ]+)\s+(\d+)\b/i);
        if (!m) return boxText.trim();
        return `${m[1].toUpperCase()} ${m[2]}`;
    }

    function maybeWarn() {
        const pon = readPon();
        const boxText = readBoxText();

        const ponFull = pon && FULL_PONS.has(pon);

        const boxBase = boxText ? normalizeBoxBaseName(boxText) : "";
        const boxFull = boxBase && FULL_BOX_BASE_NAMES.has(boxBase);

        // Solo avisar si hay algo lleno
        if (!ponFull && !boxFull) return;

        const date = todayISO();
        const reasons = [];
        if (ponFull) reasons.push(`Puerto PON LLENO: ${pon}`);
        if (boxFull) reasons.push(`Caja LLENA: ${boxBase}`);

        const message =
            `ADVERTENCIA (Wisp Tools)\n\n` +
            `${reasons.join("\n")}\n\n` +
            `Última verificación realizada: ${date}`;

        // Evitar repetir el mismo mensaje por cambios/inputs
        const key = `${pon}|${ponFull}|${boxBase}|${boxFull}|${date}`;
        if (warnedKeys.has(key)) return;
        warnedKeys.add(key);

        alert(message);
    }

    function setupAutoCheck() {
        // Chequeo inicial (al entrar)
        maybeWarn();

        // Si el usuario cambia PON (input) o caja (select), re-chequear
        const boxSel = document.getElementById("select_box");
        if (boxSel) boxSel.addEventListener("change", maybeWarn);

        const ids = ["frame_fiber_register", "slot_fiber_register", "port_fiber_register"];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            el.addEventListener("change", maybeWarn);
            el.addEventListener("input", maybeWarn);
        }
    }

    // Reintentos por si la página carga los inputs/select con delay
    (function bootWithRetries() {
        let tries = 0;
        const maxTries = 30;      // ~ 30 * 250ms = 7.5s
        const intervalMs = 250;

        const timer = setInterval(() => {
            tries++;

            const hasPonInputs =
                document.getElementById("frame_fiber_register") &&
                document.getElementById("slot_fiber_register") &&
                document.getElementById("port_fiber_register");

            const hasBox =
                document.getElementById("select_box") ||
                document.querySelector("#uniform-select_box span");

            if (hasPonInputs || hasBox) {
                clearInterval(timer);
                setupAutoCheck();
                return;
            }

            if (tries >= maxTries) {
                clearInterval(timer);
            }
        }, intervalMs);
    })();

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
