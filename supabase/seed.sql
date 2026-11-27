-- Datos iniciales de Imprenta Sanchez para Supabase.
-- Se ejecuta después de setup.sql. on conflict do nothing: no sobrescribe cambios posteriores.

insert into public.site_settings (id, value) values
  ('main', '{"brand": "Imprenta Sanchez", "slogan": "Tu idea, impresa con excelencia.", "whatsapp": "984508211", "email": "", "address": "Tres Cruces de Oro 486 – Centro Comercial La Frontera, Int. 104", "hours": "Lunes a viernes, 9:00 a.m. – 7:00 p.m. · Sábados, 9:00 a.m. – 1:00 p.m.", "facebook": "", "instagram": "", "tiktok": ""}'::jsonb)
on conflict (id) do nothing;

insert into public.services (id, title, description, icon, image, position) values
  ('srv-digital', 'Impresión digital', 'Pedidos rápidos, colores nítidos y acabados profesionales para cantidades pequeñas y medianas.', 'digital', 'img/volante_2.jpeg', 0),
  ('srv-offset', 'Impresión offset', 'Máxima calidad y rendimiento para tirajes grandes con tonos consistentes en cada hoja.', 'offset', '', 1),
  ('srv-tarjetas', 'Tarjetas de presentación', 'Diseños con laminado, mate o brillo que dejan una impresión duradera.', 'tarjeta', 'img/tajetas_servicios.png', 2),
  ('srv-volantes', 'Volantes y flyers', 'Difunde tus promociones con piezas livianas, coloridas y listas para repartir.', 'volante', 'img/volante_servicios.png', 3),
  ('srv-banners', 'Banners y afiches', 'Formatos grandes para ferias, locales y campañas que se ven desde lejos.', 'banner', '', 4),
  ('srv-sellos', 'Sellos y etiquetas', 'Identidad, empaque y presentación con sellos personalizados y etiquetas adhesivas.', 'sello', '', 5)
on conflict (id) do nothing;

insert into public.products (id, name, description, image, badge, position) values
  ('prod-tarjetas', 'Tarjetas de presentación', 'Couché 300 g con laminado mate o brillo. El detalle que eleva tu marca.', 'img/tajetas_servicios.png', 'Más vendido', 0),
  ('prod-volantes', 'Volantes promocionales', 'A todo color, papel bond o couché, en los tamaños que tu campaña necesita.', 'img/volante_servicios.png', 'A todo color', 1),
  ('prod-banner', 'Banners de gran formato', 'Lonas y lonas frontón resistentes para interior y exterior.', 'img/producto-banner.svg', 'Gran formato', 2),
  ('prod-sello', 'Sellos personalizados', 'Sellos de madera o automáticos con tu logo, nombre o mensaje.', 'img/producto-sello.svg', 'Personalizado', 3),
  ('prod-etiquetas', 'Etiquetas adhesivas', 'Rollos o láminas troqueladas para empaques, productos y eventos.', 'img/producto-etiquetas.svg', 'Nuevo', 4),
  ('prod-afiche', 'Afiches y pósters', 'Alta definición y acabados que hacen destacar cada aviso.', 'img/producto-afiche.svg', 'Alta definición', 5)
on conflict (id) do nothing;

insert into public.reviews (id, name, text, rating, status, date) values
  ('demo-1', 'María R.', 'El acabado de las tarjetas quedó increíble y el tiempo de entrega fue muy puntual. Volveremos a pedir.', 5, 'approved', '2026-09-12T10:00:00.000Z'::timestamptz),
  ('demo-2', 'Carlos M.', 'Buena atención, colores muy fieles al diseño y precios justos. Recomiendo la imprenta.', 5, 'approved', '2026-10-03T15:30:00.000Z'::timestamptz)
on conflict (id) do nothing;

-- No se copia la credencial local: el acceso en la nube se crea en Supabase Auth.
