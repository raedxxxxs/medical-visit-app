-- מאגר הנחיות קליניות
CREATE TABLE guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('diabetes', 'hypertension', 'lipids', 'screening', 'general')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  extracted_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- מטופלים (אנונימיים)
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  patient_code TEXT NOT NULL,
  initials TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female')),
  conditions TEXT[],
  medications TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, patient_code)
);

-- ביקורים שמורים
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  visit_type TEXT NOT NULL,
  visit_date DATE NOT NULL,
  patient_data JSONB,
  generated_template TEXT,
  recommendations JSONB,
  guidelines_used UUID[],
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- תבניות אישיות
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  visit_type TEXT NOT NULL,
  template_structure JSONB,
  default_fields JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- מסמכי מטופל
CREATE TABLE patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  document_type TEXT,
  document_date DATE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  extracted_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

-- Policies — כל משתמש רואה רק את הנתונים שלו
CREATE POLICY "Users see own data" ON guidelines FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON patients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON visits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own data" ON patient_documents FOR ALL USING (auth.uid() = user_id);
