-- Chat emparejamiento: texto libre solo tras atención humana (agente / moderador)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS chat_human_at TIMESTAMPTZ;

COMMENT ON COLUMN matches.chat_human_at IS 'Cuando un agente humano atiende; habilita chat libre entre embarcador y transportista.';
