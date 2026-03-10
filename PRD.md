# PRD — KeyPet: Desktop Pixel Pet for Developers

**Versión:** 1.0  
**Fecha:** 2026-03-09  
**Plataforma inicial:** macOS (Windows y Linux en fases posteriores)  
**Tecnología:** Electron + TypeScript  

---

## 1. Visión general

KeyPet es una aplicación de escritorio que muestra una mascota pixel art que vive en una esquina de la pantalla y reacciona en tiempo real a las pulsaciones del teclado del usuario. La mascota evoluciona con el tiempo según el uso, anima al usuario a mantener rachas de actividad y ofrece estadísticas detalladas de escritura desde el menubar. El objetivo es ser un compañero discreto, ligero y motivador para cualquier persona que pase muchas horas frente al teclado.

---

## 2. Objetivos del producto

- Crear una mascota pixel art animada que reaccione visualmente al ritmo de escritura del usuario.
- Registrar pulsaciones de teclado de forma local y privada (sin envío a servidores externos).
- Ofrecer estadísticas de productividad desde el menubar: hoy, semana, mes y comparativas.
- Evolucionar la mascota en 3 niveles según pulsaciones acumuladas y racha de días activos.
- Consumir el mínimo de recursos posibles (CPU y RAM).
- Arrancar automáticamente con el sistema (configurable).

---

## 3. Usuarios objetivo

Desarrolladores, escritores, diseñadores o cualquier profesional que pase muchas horas tecleando y quiera una forma lúdica y visual de ver su actividad diaria.

---

## 4. Funcionalidades principales

### 4.1 Mascota pixel art en pantalla

- La mascota se muestra siempre visible en una **esquina fija de la pantalla** (configurable: esquina superior/inferior, izquierda/derecha).
- Está renderizada sobre una ventana **transparente, sin marco, click-through** (no intercepta clics destinados a otras apps).
- Tiene **3 estados visuales base** según el ritmo de escritura en tiempo real:
  - **Idle / dormida:** Sin pulsaciones en los últimos 60 segundos.
  - **Activa / feliz:** Ritmo normal de escritura (1–5 pulsaciones/segundo).
  - **Frenética / emocionada:** Ritmo alto (>5 pulsaciones/segundo sostenido).
- Animaciones adicionales:
  - **Cansada:** Si lleva más de 2 horas de actividad sin pausa.
  - **Triste:** Si no ha habido actividad en más de 4 horas durante el horario habitual del usuario.
  - **Celebración:** Al subir de nivel.

### 4.2 Sistema de evolución (3 niveles)

La mascota evoluciona cuando se cumplen **ambas condiciones** para ese nivel:

| Nivel | Nombre sugerido | Pulsaciones acumuladas | Racha de días activos |
|-------|----------------|------------------------|----------------------|
| 1 | Huevo / Cría | 0 (inicial) | — |
| 2 | Joven | 50.000 pulsaciones | 7 días consecutivos |
| 3 | Maestro | 500.000 pulsaciones | 30 días consecutivos |

- Cada nivel tiene un sprite pixel art distinto con sus propias animaciones.
- Al evolucionar se muestra una animación especial y una notificación del sistema.
- El progreso hacia la evolución es visible en el panel de stats.

### 4.3 Conteo y estadísticas de pulsaciones

Datos registrados localmente en SQLite:

- **Hoy:** Total de pulsaciones de la jornada actual.
- **Esta semana:** Total de la semana en curso (lunes–domingo).
- **Este mes:** Total del mes en curso.
- **Comparativa:** % de variación respecto al día/semana/mes anterior.
- **Horas pico:** Gráfico de barras por hora del día con mayor actividad.
- **Racha activa:** Número de días consecutivos con al menos 100 pulsaciones.
- **Total histórico:** Pulsaciones totales acumuladas desde el primer uso.

### 4.4 Menubar icon

- Icono en la barra de menú de macOS (menubar) con un mini-sprite de la mascota.
- Al hacer clic abre un **popover nativo** con:
  - Resumen rápido: pulsaciones de hoy y racha actual.
  - Botón para abrir el **panel completo de estadísticas**.
  - Acceso rápido a ajustes.
  - Opción de ocultar/mostrar la mascota en pantalla.
  - Opción de salir de la app.

### 4.5 Panel de estadísticas

Ventana secundaria (abre desde el menubar) con:

- Tabs: **Hoy / Semana / Mes / Histórico**.
- Gráfico de horas pico (barras por hora).
- Gráfico de actividad semanal (barras por día).
- Progreso hacia la próxima evolución (barra de progreso dual: pulsaciones + racha).
- Historial de evoluciones con fecha.

### 4.6 Notificaciones

- **Subida de nivel:** Notificación nativa del sistema al evolucionar.
- **Mascota triste:** Notificación suave si no hay actividad en >4 horas durante el horario habitual del usuario (configurable o desactivable).

### 4.7 Ajustes

Accesibles desde el menubar:

| Ajuste | Opciones |
|--------|----------|
| Esquina de la mascota | Superior-izq / Superior-der / Inferior-izq / Inferior-der |
| Tamaño de la mascota | Pequeño / Normal / Grande |
| Arranque automático | Activado / Desactivado |
| Notificaciones | Todas / Solo evolución / Ninguna |
| Horario habitual | Rango de horas activas (para la notificación de mascota triste) |
| Resetear mascota | Opción con confirmación (borra datos) |

---

## 5. Requisitos no funcionales

### 5.1 Rendimiento
- Uso de CPU en reposo: **< 0,5%**
- Uso de CPU durante animaciones: **< 2%**
- Uso de RAM: **< 80 MB**
- El listener de teclado debe usar hooks nativos del sistema (no polling).

### 5.2 Privacidad y seguridad
- **No se registra qué teclas se pulsan**, solo el conteo numérico.
- Todos los datos se almacenan localmente en SQLite (`~/Library/Application Support/KeyPet/`).
- No hay telemetría ni conexión a internet.
- Solicitar permiso de Accesibilidad en macOS la primera vez (necesario para el listener global de teclado) con explicación clara al usuario.

### 5.3 Compatibilidad
- **macOS:** 12 Monterey o superior (fase 1).
- **Windows / Linux:** Fase 2 (misma base Electron).

### 5.4 Instalación
- Distribuido como `.dmg` para macOS.
- Firma con Apple Developer ID para evitar el warning de Gatekeeper.

---

## 6. Arquitectura técnica (alto nivel)

```
KeyPet/
├── main/                    # Proceso principal Electron (Node.js)
│   ├── keyboard-listener.ts # Hook global de teclado (iohook / uiohook-napi)
│   ├── database.ts          # SQLite con better-sqlite3
│   ├── stats-engine.ts      # Cálculo de estadísticas y evolución
│   ├── tray.ts              # Menubar icon y popover
│   └── autostart.ts         # Login item (macOS LaunchAgent)
├── renderer/                # Proceso renderer (ventana transparente)
│   ├── pet/                 # Lógica de animación pixel art
│   │   ├── sprites/         # Spritesheets PNG por nivel y estado
│   │   └── animator.ts      # Motor de animación por frames
│   └── stats-panel/         # Panel de estadísticas (React o Vanilla TS)
└── shared/                  # Tipos y constantes compartidos
```

**Librerías clave:**
- `uiohook-napi` — Listener global de teclado sin polling.
- `better-sqlite3` — Base de datos local, síncrona y rápida.
- `electron-store` — Persistencia de ajustes.
- `open-login-items` o `auto-launch` — Arranque con el sistema.

---

## 7. Diseño visual

- **Estilo:** Pixel art retro, paleta de colores limitada (16–32 colores por sprite).
- **Tamaño del sprite:** 64×64 px (escala ×2 → 128×128 en pantalla por defecto).
- **Animaciones:** Entre 4 y 8 frames por estado, loop continuo.
- **Ventana de la mascota:** Transparente, `always-on-top`, sin decoración, `click-through` salvo si el usuario hace clic directamente sobre el sprite.
- El personaje concreto (animal, criatura, robot...) se definirá en la fase de diseño de assets.

---

## 8. Flujo de onboarding

1. Primera apertura → Pantalla de bienvenida con nombre y concepto de KeyPet.
2. Solicitud de permiso de Accesibilidad (macOS) con explicación de privacidad.
3. Elección de esquina para la mascota.
4. Activar/desactivar arranque automático.
5. La mascota aparece en pantalla y comienza a escuchar el teclado.

---

## 9. Fases de desarrollo

### Fase 1 — macOS MVP
- [ ] Setup Electron + TypeScript + estructura base
- [ ] Listener global de teclado + conteo
- [ ] Almacenamiento SQLite diario
- [ ] Ventana transparente con mascota animada (nivel 1 únicamente)
- [ ] Menubar con resumen rápido
- [ ] Ajustes básicos (esquina, arranque automático)
- [ ] Onboarding de permisos

### Fase 2 — Features completos
- [ ] Panel de estadísticas completo con gráficos
- [ ] Sistema de evolución (niveles 2 y 3)
- [ ] Notificaciones nativas
- [ ] Todos los estados de animación (cansada, triste, celebración)
- [ ] Comparativas históricas

### Fase 3 — Multiplataforma
- [ ] Port a Windows (adaptar listener y autostart)
- [ ] Port a Linux
- [ ] Distribución en tiendas / instaladores nativos

---

## 10. Métricas de éxito (uso personal)

- La app arranca en < 3 segundos.
- La mascota responde a pulsaciones en < 100 ms.
- El uso de CPU no supera el 2% en ningún momento de uso normal.
- Las estadísticas reflejan correctamente el conteo al final del día.

---

*Documento generado el 2026-03-09. Sujeto a revisión antes de iniciar la Fase 1.*