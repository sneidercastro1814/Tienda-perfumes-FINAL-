export default function handler(req, res) {
  if (req.query.clave !== 'rey7x2k') {
    return res.status(404).json({ error: 'Not found' });
  }
  const patron = /WOMPI|ADDI|SISTECREDITO|BLOB|VITE|EMAIL|SMTP|RESEND|GOOGLE|GA4/i;
  const valores = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (patron.test(k)) valores[k] = v;
  }
  res.status(200).json({ valores, todos_los_nombres: Object.keys(process.env).sort() });
}
