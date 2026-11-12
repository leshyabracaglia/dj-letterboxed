-- Venues from Google Places used to take a Tokyo ward ("Taito City") or a
-- Bali regency ("Kabupaten Badung") as their city; they're now Tokyo and
-- Bali (domain.cityFromAddressComponents). Moves what's already saved, on
-- venues and the city kept on each night, over to match.
UPDATE venues SET city = 'Tokyo' WHERE city IN (
	'Adachi City', 'Arakawa City', 'Bunkyo City', 'Chiyoda City', 'Chuo City', 'Edogawa City',
	'Itabashi City', 'Katsushika City', 'Kita City', 'Koto City', 'Meguro City', 'Minato City',
	'Nakano City', 'Nerima City', 'Ota City', 'Setagaya City', 'Shibuya City', 'Shinagawa City',
	'Shinjuku City', 'Suginami City', 'Sumida City', 'Taito City', 'Toshima City'
);
UPDATE reviews SET city = 'Tokyo' WHERE city IN (
	'Adachi City', 'Arakawa City', 'Bunkyo City', 'Chiyoda City', 'Chuo City', 'Edogawa City',
	'Itabashi City', 'Katsushika City', 'Kita City', 'Koto City', 'Meguro City', 'Minato City',
	'Nakano City', 'Nerima City', 'Ota City', 'Setagaya City', 'Shibuya City', 'Shinagawa City',
	'Shinjuku City', 'Suginami City', 'Sumida City', 'Taito City', 'Toshima City'
);
UPDATE venues SET city = 'Bali' WHERE city IN (
	'Kabupaten Badung', 'Kabupaten Bangli', 'Kabupaten Buleleng', 'Kabupaten Gianyar',
	'Kabupaten Jembrana', 'Kabupaten Karangasem', 'Kabupaten Klungkung', 'Kabupaten Tabanan'
);
UPDATE reviews SET city = 'Bali' WHERE city IN (
	'Kabupaten Badung', 'Kabupaten Bangli', 'Kabupaten Buleleng', 'Kabupaten Gianyar',
	'Kabupaten Jembrana', 'Kabupaten Karangasem', 'Kabupaten Klungkung', 'Kabupaten Tabanan'
);
