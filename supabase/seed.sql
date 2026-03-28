begin;

insert into public.approved_doctors (
  full_name,
  dni,
  license_number,
  organization,
  specialty,
  status
)
values
  (
    'Dra. Martina Quiroga',
    '30111222',
    'MN-145872',
    'OSDE',
    'Clinica medica',
    'approved'
  ),
  (
    'Dr. Federico Alvarez',
    '28444555',
    'MN-132564',
    'Swiss Medical',
    'Cardiologia',
    'approved'
  ),
  (
    'Dra. Camila Benitez',
    '32666777',
    'MN-158903',
    'Galeno',
    'Pediatria',
    'approved'
  )
on conflict (dni) do update
set
  full_name = excluded.full_name,
  license_number = excluded.license_number,
  organization = excluded.organization,
  specialty = excluded.specialty,
  status = excluded.status,
  updated_at = timezone('utc', now());

insert into public.pharmacies (
  name,
  location,
  address,
  zone,
  city,
  whatsapp_number,
  accepts_digital_prescription,
  is_active
)
select
  seed.name,
  seed.location,
  seed.address,
  seed.zone,
  seed.city,
  seed.whatsapp_number,
  seed.accepts_digital_prescription,
  seed.is_active
from (
  values
    (
      'Farmacia Central Caballito',
      'Caballito',
      'Av. Rivadavia 5100',
      'CABA Centro',
      'Buenos Aires',
      '5491160010001',
      true,
      true
    ),
    (
      'Farmacia Norte Belgrano',
      'Belgrano',
      'Av. Cabildo 2450',
      'CABA Norte',
      'Buenos Aires',
      '5491160010002',
      true,
      true
    )
) as seed(name, location, address, zone, city, whatsapp_number, accepts_digital_prescription, is_active)
where not exists (
  select 1
  from public.pharmacies p
  where p.name = seed.name
    and coalesce(p.address, '') = coalesce(seed.address, '')
);

commit;
