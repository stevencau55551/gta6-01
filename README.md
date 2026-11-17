# Teluk Arun — Kisah Jalanan

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/stevencau55551/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/stevencau55551/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

Game open-world kriminal 2D top-down yang orisinal, dibuat untuk bounty
[Make GTA 6 (gta6-01)](https://make.fun/c/gta6-01) di make.fun. Berjalan
offline di desktop Chrome dari file statis — tanpa build step, tanpa
network request, tanpa library eksternal.

## Cerita

Raka Pradana, mantan kurir, terlilit utang geng Pelabuhan. Di kota pesisir
**Teluk Arun** — Pasar Senja, Pantai Arun, Taman Kota, Kampung Nelayan,
Pelabuhan, sampai SPBU Arun — Raka harus mengantar paket, mencuri mobil
sport, kabur dari polisi, lalu menghadapi bos geng **Darma** di pelabuhan
pada malam hari. Semua kota, karakter, kendaraan, nama, cerita, art, suara,
dan musik dibuat sendiri; tidak ada apa pun dari Grand Theft Auto Rockstar
atau game komersial lain.

## Cara main

```sh
node serve.ts        # lalu buka http://localhost:8080
```

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Jalan kaki / kemudi mobil |
| E | Masuk & curi mobil, keluar mobil |
| Klik mouse | Menembak (jalan kaki) |
| Spasi | Memukul |
| H | Klakson |
| P / Esc | Jeda |
| M | Suara hidup/mati |

## Sistem yang ada

- **Kota terbuka** 3600×2600 dengan 8 distrik bernama, jalan, zebra cross,
  taman, pantai berombak, pelabuhan, rumah sakit, kantor polisi, dan pasar.
- **Lalu lintas & pejalan kaki** — sedan, taksi, truk, bus kota, dan pejalan
  kaki yang panik saat ada kejar-kejaran.
- **Wanted 0–5 bintang** — curi mobil, tabrak pejalan kaki, atau kalahkan
  bos menaikkan bintang; polisi mengejar dengan sirene dan strobo, bintang
  padam bila lama bersembunyi.
- **3 misi berantai** — Pesanan Terakhir, Utang Lama (curi mobil sport,
  kabur sampai wanted 0), Pelabuhan Malam (lawan 4 anak buah + bos Darma).
- **Combat** — pistol (klik mouse), pukulan, musuh yang menembak sambil
  strafe, ledakan saat bos tumbang.
- **Bensin & SPBU** — tangki habis membuat mobil mogok; isi di SPBU Arun.
- **10 koin Arun** tersembunyi di seluruh kota (+$60 tiap koin).
- **Kerja taksi** — naik taksi, jemput penumpang, antar ke tujuan, terima tarif.
- **HUD + minimap** — nyawa, uang, koin, bensin, jam dalam game, nama
  distrik, progres misi, penyebab wanted, dan minimap dengan landmark,
  koin, polisi, dan objektif.
- **Save otomatis** di localStorage (misi, uang, HP, peluru, koin, tarif).
- **Suara & musik** WebAudio murni: tembakan, klakson, sirene, denting
  koin, dan loop pentatonik orisinal. Efek: partikel, jejak ban, guncangan
  kamera, cahaya matahari sore.

## Struktur kode

| File | Tugas |
| --- | --- |
| `main.ts` | Program penyerah: salin `game/` + `screenshots/` ke `/output`, tulis `dossier.json` |
| `serve.ts` | Server statis lokal (traversal-proof) untuk main |
| `game/index.html` | Shell halaman + menu overlay |
| `game/src/main.js` | Loop game, state, aksi pemain, mode screenshot |
| `game/src/world.js` | Layout kota, distrik, landmark, koin, render dunia |
| `game/src/entities.js` | Pemain, kendaraan, pejalan kaki, fisika mobil |
| `game/src/systems.js` | Wanted, misi, combat, koin, kerja taksi |
| `game/src/input-ui.js` | Kontrol, HUD, minimap, menu |
| `game/src/effects.js` | Partikel, jejak ban, ledakan, cahaya, audio/musik |
| `vendor/makefun-game.ts` | Library dossier dari kit (tidak diubah) |

## Screenshot

`screenshots/` berisi 4 render asli game: overview Pasar Senja, mengemudi
taksi, kejar-kejaran polisi (wanted ★★★), dan pertarungan di pelabuhan.

## Lisensi

MIT — lihat [LICENSE](LICENSE).
