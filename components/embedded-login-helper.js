"use client";

import { useEffect, useState } from "react";

export default function EmbeddedLoginHelper() {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  if (!embedded) return null;

  return (
    <div className="embeddedLoginNotice">
      <strong>Acceso desde GHL</strong>
      <p>
        PETS guardará esta sesión únicamente dentro de este panel de GHL.
        Si el navegador no permite continuar después de ingresar, abre PETS en una pestaña independiente.
      </p>
      <a href="/login?modo=independiente" target="_blank" rel="noopener noreferrer">
        Abrir PETS en otra pestaña
      </a>
    </div>
  );
}
