# Portfolio Profesional - [Enrique Alonso Puig]

Este proyecto es una plataforma web para la presentación de mi perfil profesional, proyectos y competencias en desarrollo de software.

## Entorno de Producción
* **URL Pública:** [https://quiquealonso.github.io/portfolioQ/](https://quiquealonso.github.io/portfolioQ/)

## Arquitectura de Despliegue
* **Evento Disparador (Trigger):** `push` sobre la rama principal (`main`).
* **Servicio Ejecutor:** **GitHub Actions** (ejecuta el workflow automático) y **GitHub Pages** (servidor donde se aloja la web).
* **Definición del Workflow:** Archivo de configuración en [`.github/workflows/static.yml`](./.github/workflows/static.yml).

## Estructura del Repositorio
```
portfolio/
├── .github/workflows/
│   └── static.yml    # Workflow de integración y despliegue continuo
├── index.html        # Página principal (Walking Skeleton)
├── LICENSE           # Licencia del proyecto
└── README.md         # Documentación del repositorio
```
