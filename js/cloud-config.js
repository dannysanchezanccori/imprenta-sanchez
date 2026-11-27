/* ==========================================================================
   CONFIGURACIÓN DE SUPABASE (solo para GitHub Pages)
   --------------------------------------------------------------------------
   Deja enabled: false para usar el servidor local (INICIAR.bat).
   Para publicar en GitHub Pages:
     1. Mantén enabled en true.
     2. La URL ya se formó con el Project Ref del proyecto.
     3. Pega la clave pública: "Publishable key" (sb_publishable_...)
        o, si tu proyecto usa las antiguas, "anon public" (eyJ...).
        NUNCA pongas una clave secreta (sb_secret_... / service_role).
   La clave pública es segura para el navegador: la protección real son
   las políticas RLS de supabase/setup.sql.
   ========================================================================== */

window.CLOUD_CONFIG = {
  enabled: true,
  url: 'https://pvrcmdhruhykyrsbqotj.supabase.co',
  anonKey: 'sb_publishable_rAtdYbSpQRq21sWtvj0Hng_6eBMASd8',
  storageBucket: 'imagenes'
};
