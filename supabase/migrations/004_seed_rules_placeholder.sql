-- ============================================================
-- RÈGLES — SQUELETTE. enabled=false PARTOUT.
-- L'ingénierie (conditions, seuils, textes) = GABIN, plus tard.
-- Le moteur tourne sans elles : zones + métriques restent visibles,
-- le brief narre les chiffres sans prescription tant que rien n'est activé.
-- ============================================================
insert into rules (id, description, metric, condition_sql, flag_code, severity, recommendation, priority, enabled) values
('R-01','Zone GREEN — adaptation normale (±15% EMA)','zone','zone = ''GREEN''','ADAPTATION_OK','info','__A_REDIGER_PAR_GABIN__',900,false),
('R-02','Zone BLUE — sous la norme personnelle','zone','zone = ''BLUE''','BELOW_BASELINE','monitor','__A_REDIGER_PAR_GABIN__',200,false),
('R-03','Zone YELLOW — spike au-dessus de la norme','zone','zone = ''YELLOW''','SPIKE','monitor','__A_REDIGER_PAR_GABIN__',150,false),
('R-04','ACWR zone de danger','acwr','acwr > 1.15','DANGER_ZONE','danger','__A_REDIGER_PAR_GABIN__',100,false),
('R-05','Déclin EMA 3 semaines (pattern pré-blessure Cesson)','ema_28','__CONDITION_A_DEFINIR_PAR_GABIN__','TREND_DECLINE','danger','__A_REDIGER_PAR_GABIN__',110,false),
('R-07','Worry flag psychologique','worry_level','worry_level > 70','WORRY_FLAG','danger','__A_REDIGER_PAR_GABIN__',120,false)
on conflict (id) do nothing;
