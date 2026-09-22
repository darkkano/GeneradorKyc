const COUNTRIES = [
  { id: 'VE', name: 'Venezuela', base: 3, currency: 'USD', idLabel: 'Cédula de identidad' },
  { id: 'CO', name: 'Colombia', base: 2, currency: 'COP', idLabel: 'Cédula de ciudadanía' },
  { id: 'MX', name: 'México', base: 2, currency: 'MXN', idLabel: 'CURP / INE' },
  { id: 'PE', name: 'Perú', base: 1, currency: 'PEN', idLabel: 'DNI' },
  { id: 'ES', name: 'España', base: 1, currency: 'EUR', idLabel: 'DNI / NIE' },
  { id: 'US', name: 'Estados Unidos', base: 2, currency: 'USD', idLabel: 'SSN (últimos 4) / pasaporte' },
];

const ACTIVITIES = [
  { id: 'persona', label: 'Persona natural' },
  { id: 'empresa', label: 'Empresa / persona jurídica' },
  { id: 'fintech', label: 'Fintech / MSP' },
  { id: 'efectivo', label: 'Negocio intensivo en efectivo' },
];

function countryOf(id) {
  return COUNTRIES.find((item) => item.id === id) || COUNTRIES[0];
}

function bandOf(score) {
  if (score >= 5) {
    return 'high';
  }
  if (score >= 3) {
    return 'mid';
  }
  return 'low';
}

function resolveRisk({ country, activity, volumeUsd, override }) {
  if (override && override !== 'auto') {
    return override;
  }
  const meta = countryOf(country);
  let score = meta.base;
  if (activity === 'efectivo' || activity === 'fintech') {
    score += 2;
  }
  if (activity === 'empresa') {
    score += 1;
  }
  if (Number(volumeUsd) >= 8000) {
    score += 2;
  } else if (Number(volumeUsd) >= 2500) {
    score += 1;
  }
  return bandOf(score);
}

function field(partial) {
  return { required: false, ...partial };
}

function visibleWhen(key, value) {
  return { field: key, op: 'eq', value };
}

function buildSchema({ country, activity, volumeUsd, risk, answers = {} }) {
  const meta = countryOf(country);
  const pep = answers.pep === true || answers.pep === 'true' || answers.pep === 'si';
  const docKind = answers.docKind || (risk === 'high' ? 'pasaporte' : 'nacional');
  const steps = [];
  const thoughts = [];

  thoughts.push(`Perfil ${meta.name}, actividad ${activity}, volumen ~${volumeUsd} USD/mes.`);
  thoughts.push(`Banda de riesgo ${risk}. Voy a emitir reglas JSON, no HTML.`);

  const identity = {
    id: 'identidad',
    title: 'Identidad',
    description: 'Quién es el cliente y con qué documento se presenta.',
    fields: [
      field({
        key: 'fullName',
        type: 'text',
        label: 'Nombre completo / razón social',
        required: true,
        autocomplete: 'name',
      }),
      field({
        key: 'dob',
        type: 'date',
        label: activity === 'empresa' ? 'Fecha de constitución' : 'Fecha de nacimiento',
        required: true,
      }),
      field({
        key: 'docKind',
        type: 'select',
        label: 'Tipo de documento',
        required: true,
        value: docKind,
        options: [
          { value: 'nacional', label: meta.idLabel },
          { value: 'pasaporte', label: 'Pasaporte' },
          { value: 'residencia', label: 'Residencia / NIE / visa' },
        ],
      }),
      field({
        key: 'docNumber',
        type: 'text',
        label: 'Número de documento',
        required: true,
        pattern: country === 'MX' ? '^[A-Z0-9]{10,18}$' : '^[A-Za-z0-9\\-]{5,20}$',
        hint: country === 'MX' ? 'CURP a 18 caracteres si aplica' : undefined,
      }),
    ],
  };

  if (country === 'US') {
    identity.fields.push(
      field({
        key: 'ssn4',
        type: 'text',
        label: 'SSN (últimos 4)',
        required: risk !== 'low',
        pattern: '^\\d{4}$',
      }),
    );
  }
  if (country === 'ES') {
    identity.fields.push(
      field({
        key: 'nie',
        type: 'text',
        label: 'NIE (si no es nacional)',
        when: visibleWhen('docKind', 'residencia'),
      }),
    );
  }
  if (country === 'VE' || risk === 'high') {
    thoughts.push('Para este usuario pide foto del pasaporte.');
    identity.fields.push(
      field({
        key: 'passportPhoto',
        type: 'file',
        label: 'Foto del pasaporte (página de datos)',
        accept: 'image/*',
        required: true,
        hint: 'Contraste alto, sin recortes. El motor de riesgo VE/high lo exige.',
      }),
    );
  }
  if (country === 'MX') {
    identity.fields.push(
      field({
        key: 'inePhoto',
        type: 'file',
        label: 'Foto del INE (frente)',
        accept: 'image/*',
        required: risk !== 'low',
      }),
    );
  }
  if (risk !== 'low') {
    identity.fields.push(
      field({
        key: 'selfie',
        type: 'file',
        label: 'Selfie con el documento',
        accept: 'image/*',
        required: risk === 'high',
        hint: 'Rostro y documento en el mismo encuadre.',
      }),
    );
  }
  identity.fields.push(
    field({
      key: 'nationalIdPhoto',
      type: 'file',
      label: `Foto de ${meta.idLabel}`,
      accept: 'image/*',
      required: risk !== 'high',
      when: { field: 'docKind', op: 'neq', value: 'pasaporte' },
    }),
  );
  steps.push(identity);

  const contact = {
    id: 'contacto',
    title: 'Contacto y domicilio',
    description: 'Dónde vive y cómo se le notifica.',
    fields: [
      field({ key: 'email', type: 'email', label: 'Correo', required: true, autocomplete: 'email' }),
      field({
        key: 'phone',
        type: 'tel',
        label: 'Teléfono móvil',
        required: true,
        autocomplete: 'tel',
      }),
      field({ key: 'city', type: 'text', label: 'Ciudad', required: true }),
      field({
        key: 'address',
        type: 'textarea',
        label: country === 'VE' ? 'Dirección (urbanización / parroquia)' : 'Dirección fiscal',
        required: true,
      }),
    ],
  };
  if (risk !== 'low') {
    thoughts.push('Pido comprobante de domicilio reciente.');
    contact.fields.push(
      field({
        key: 'proofAddress',
        type: 'file',
        label: 'Comprobante de domicilio (< 90 días)',
        accept: 'image/*,application/pdf',
        required: risk === 'high',
      }),
    );
  }
  if (country === 'VE') {
    contact.fields.push(
      field({
        key: 'state',
        type: 'select',
        label: 'Estado',
        required: true,
        options: ['Distrito Capital', 'Miranda', 'Zulia', 'Carabobo', 'Lara', 'Otro'].map((label) => ({
          value: label,
          label,
        })),
      }),
    );
  }
  steps.push(contact);

  const compliance = {
    id: 'cumplimiento',
    title: 'Cumplimiento',
    description: 'PEP, origen de fondos y declaración.',
    fields: [
      field({
        key: 'pep',
        type: 'radio',
        label: '¿Es persona expuesta políticamente (PEP) o familiar de PEP?',
        required: true,
        options: [
          { value: 'no', label: 'No' },
          { value: 'si', label: 'Sí' },
        ],
      }),
      field({
        key: 'occupation',
        type: 'text',
        label: 'Ocupación / giro',
        required: true,
      }),
    ],
  };

  if (risk === 'high' || pep) {
    thoughts.push(
      pep
        ? 'El cliente marcó PEP: amplío cargo, país y fuente de riqueza.'
        : 'Riesgo alto: origen de fondos y declaración jurada.',
    );
    compliance.fields.push(
      field({
        key: 'pepRole',
        type: 'text',
        label: 'Cargo / institución PEP',
        required: pep,
        when: visibleWhen('pep', 'si'),
      }),
      field({
        key: 'pepCountry',
        type: 'text',
        label: 'País donde ejerce el cargo',
        required: pep,
        when: visibleWhen('pep', 'si'),
      }),
      field({
        key: 'sourceFunds',
        type: 'select',
        label: 'Origen de fondos',
        required: true,
        options: [
          { value: 'salario', label: 'Salario / honorarios' },
          { value: 'empresa', label: 'Utilidades de empresa' },
          { value: 'venta', label: 'Venta de activo' },
          { value: 'herencia', label: 'Herencia / donación' },
          { value: 'crypto', label: 'Activos virtuales' },
        ],
      }),
      field({
        key: 'sourceDetail',
        type: 'textarea',
        label: 'Detalle del origen de fondos',
        required: true,
        hint: 'Empleador, RIF, o referencia de la operación.',
      }),
      field({
        key: 'wealth',
        type: 'money',
        label: 'Patrimonio declarado (USD)',
        required: true,
        min: 0,
      }),
    );
  }

  if (activity === 'empresa' || activity === 'fintech') {
    thoughts.push('Persona jurídica: pido beneficiarios finales (repeater).');
    compliance.fields.push(
      field({
        key: 'owners',
        type: 'repeater',
        label: 'Beneficiarios finales (> 10%)',
        required: true,
        minItems: 1,
        maxItems: 6,
        itemLabel: 'Beneficiario',
        fields: [
          field({ key: 'name', type: 'text', label: 'Nombre', required: true }),
          field({ key: 'share', type: 'money', label: '% participación', required: true, min: 10, max: 100 }),
          field({ key: 'country', type: 'text', label: 'Nacionalidad', required: true }),
        ],
      }),
    );
  }

  if (activity === 'efectivo' || risk === 'high') {
    compliance.fields.push(
      field({
        key: 'cashExplain',
        type: 'textarea',
        label: 'Por qué opera con efectivo / alto volumen',
        required: true,
      }),
    );
  }

  compliance.fields.push(
    field({
      key: 'attest',
      type: 'checkbox',
      label: 'Declaro que la información es veraz y autorizo la verificación KYC.',
      required: true,
    }),
  );
  steps.push(compliance);

  const rationale = thoughts.join(' ');
  const id = `sch_${country}_${risk}_${Date.now().toString(36)}`;

  return {
    schema: {
      id,
      engine: 'lince-gen-ui',
      version: 1,
      country,
      countryName: meta.name,
      activity,
      volumeUsd: Number(volumeUsd) || 0,
      risk,
      currency: meta.currency,
      title: `Alta KYC — ${meta.name}`,
      rationale,
      steps,
    },
    thoughts,
    prompt: `Genera las reglas de formulario KYC en JSON para país=${country} actividad=${activity} volumenUsd=${volumeUsd} riesgo=${risk}. No emitas HTML. Campos con type, key, label, required, when.`,
  };
}

async function stream(res, payload) {
  const { schema, thoughts, prompt } = payload;
  res.write(`data: ${JSON.stringify({ type: 'meta', prompt, risk: schema.risk, country: schema.country })}\n\n`);
  for (const line of thoughts) {
    res.write(`data: ${JSON.stringify({ type: 'think', text: line })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 280));
  }
  const raw = JSON.stringify(schema, null, 2);
  const chunk = 48;
  for (let i = 0; i < raw.length; i += chunk) {
    res.write(`data: ${JSON.stringify({ type: 'json', text: raw.slice(i, i + chunk) })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 12));
  }
  res.write(`data: ${JSON.stringify({ type: 'schema', schema })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
}

module.exports = {
  COUNTRIES,
  ACTIVITIES,
  countryOf,
  resolveRisk,
  buildSchema,
  stream,
};
