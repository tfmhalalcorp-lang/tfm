-- =====================================================================
-- Preflight check for import_production_data.sql
-- =====================================================================
-- Confirms every master-data code the import needs (can size / brand /
-- supplier / machine) already exists in your live Settings data. Run
-- this BEFORE import_production_data.sql — any row returned here means
-- that code is MISSING, and every import row that needs it will fail
-- (its FK lookup returns NULL, which then violates the "not null"
-- column) unless you add it first (Settings → the matching screen) or
-- rename the code to match what you already have.
--
-- NOTE on the brand list below: the source spreadsheet's brand codes
-- are a messy mix — short codes (BHC, LSS, ...), free-text descriptions
-- ("2 in oil", "B grade(PDS)"), Thai dish names, and a couple of values
-- that look like stray batch codes (e.g. 'O1VMAGZ1'). That's exactly
-- what's in the sheet's own Brand tab too, not something introduced by
-- the import — this list is a direct, unedited extract of the 59
-- distinct brand_id values actually referenced by ProdBatch/WHIn.
-- =====================================================================

-- Can sizes
select 'can_sizes' as table_name, code from (values
  ('202x307'), ('202x308'), ('300x407'), ('300x408')
) as needed(code)
where not exists (select 1 from public.can_sizes where cansize_code = needed.code);

-- Suppliers
select 'suppliers' as table_name, code from (values
  ('1'), ('4'), ('5'), ('7.1'), ('8'), ('9')
) as needed(code)
where not exists (select 1 from public.suppliers where supplier_code = needed.code);

-- Machines
select 'machines' as table_name, code from (values
  ('DW.04'), ('SF.03'), ('SM.01'), ('SM.02'), ('SM.03'), ('SM.04')
) as needed(code)
where not exists (select 1 from public.machines where machine_code = needed.code);

-- Brands (59 distinct codes actually referenced by the import)
select 'brands' as table_name, code from (values
  ('1.1NTB'),
  ('1NTB'),
  ('2 in oil'),
  ('2 in oil (PDS.)'),
  ('A grade'),
  ('A+'),
  ('AT chilli'),
  ('ATP18%'),
  ('Aro'),
  ('B'),
  ('B grade (PDS)'),
  ('B grade(PDS)'),
  ('BHC'),
  ('BHS'),
  ('CVC'),
  ('CVS'),
  ('ES'),
  ('FNS'),
  ('In oil'),
  ('KSC'),
  ('KSS'),
  ('LC1'),
  ('LC2'),
  ('LFB'),
  ('LSS'),
  ('M&K'),
  ('MDN'),
  ('MNS'),
  ('Mac oil'),
  ('O1VMAGZ1'),
  ('OEE OEE'),
  ('OKK'),
  ('PD.S'),
  ('PD.s'),
  ('PDD'),
  ('PDS'),
  ('PDSทดลองแป้ง'),
  ('PP'),
  ('PP Premium'),
  ('PP(PDS)'),
  ('QU'),
  ('RLC'),
  ('SBM'),
  ('SBS'),
  ('SRS'),
  ('SSC'),
  ('Test'),
  ('VGF'),
  ('VGF C'),
  ('Vega'),
  ('sss s'),
  ('คั่วพริกเกลือ'),
  ('ต้มข่า'),
  ('น้ำยาขนมจีน'),
  ('ผัดเผ็ด'),
  ('ผัดเผ็ดปลาดุก'),
  ('เนื้อปลาซาบะ ผัดพริกเกลือ'),
  ('เนื้อปลาซาบะ ผัดไข่เค็ม'),
  ('แกงส้ม')
) as needed(code)
where not exists (select 1 from public.brands where brand_code = needed.code);
