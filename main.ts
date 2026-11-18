// V-reversal untuk cbBTC (CBBTC/USDC), bar 1 menit,
// btc-race-24h-20261118-1444.
//
// Gagasan: jangan kejar harga yang jatuh — tunggu sampai jatuhnya
// TERBUKTI berhenti, lalu beli pantulannya. Bot ini hanya masuk sekali
// pada satu syarat yang sama, tanpa tangga dan tanpa syarat tambahan
// yang berubah sesudah pembelian pertama:
//
//   1. Harga sudah jatuh DALAM: close >= 200 bps di bawah puncak
//      60 bar terakhir.
//   2. Bar ini adalah bar PEMBALIKAN: bar hijau (close di atas open)
//      DAN close di atas close bar sebelumnya. Bar merah, betapa pun
//      dalamnya jurang, tidak pernah dibeli — pembalikan harus
//      terlihat dulu di harga, bukan ditebak.
//
// Dua filter itu yang membedakan bot ini dari sekadar "beli saat murah":
// di tiga window dev, melepas filter hijau saja mengubah window 0828
// dari +13,83 menjadi -29,27, karena bar hijau pertama sesudah
// longsoran adalah yang memisahkan lembah yang memantul dari longsoran
// yang masih berlanjut. Sebaliknya, konfirmasi yang lebih ketat lagi
// (dua close hijau beruntun, atau badan hijau besar) terbukti
// menunda masuk sampai pantulan sudah lewat: di window 0603 ia
// membuat bot tidak masuk sama sekali.
//
// Sekali masuk, bot memakai seluruh kas (long only, satu posisi,
// maksimal DUA pembelian per window) dan keluar lewat satu dari tiga
// pintu, tanpa trailing, tanpa jeda antar pembelian:
// ambil untung +280 bps, potong rugi -120 bps, atau paksa keluar
// setelah 420 bar. Batas rugi yang lebar (-120, bukan -60/-80)
// disengaja: di window 0828 pembelian pertama memang memotong rugi
// (-134 bps sampai fill), dan pembelian keduanyalah — di lembah baru
// yang lebih dalam, dip 234 — yang mengambil +291 bps dan menutup
// window dengan untung.
//
// Semua hitungan memakai bilangan bulat pada satuan harga (bigint),
// tanpa jam, tanpa acak, tanpa lingkungan: dua run pada data yang sama
// menghasilkan order yang sama persis.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const ASSET = 'CBBTC';
// Berapa bar ke belakang untuk mengukur jurang.
const WINDOW = 60;
// Jurang minimum (bps di bawah puncak rolling) untuk masuk.
const DIP = 200n;
// Pintu keluar: ambil untung / potong rugi (bps terhadap harga fill
// masuk) dan batas tahan (bar).
const TAKE_PROFIT = 280n;
const STOP_LOSS = 120n;
const MAX_HOLD = 420;
// Pembelian maksimum sepanjang window.
const MAX_BUYS = 2;
const SLIP = 150;

/** Memori bot: riwayat open/close dan keadaan posisi terbuka. */
const state = {
  /** Open tiap bar yang terlihat, sebagai bigint pada skala harga. */
  opens: [] as bigint[],
  /** Close tiap bar yang terlihat, sebagai bigint pada skala harga. */
  closes: [] as bigint[],
  /** Harga fill pembelian yang membuka posisi saat ini, 0n bila flat. */
  entryFill: 0n,
  /** Bar yang sudah dilewati sejak fill pembelian (termasuk bar fill). */
  heldBars: 0,
  /** Berapa pembelian yang sudah terisi sepanjang window. */
  buys: 0,
};

/** Puncak tertinggi dari `WINDOW` close terakhir (termasuk close kini). */
function rollingPeak(): bigint {
  let top = 0n;
  const from = state.closes.length - WINDOW > 0 ? state.closes.length - WINDOW : 0;
  for (let i = from; i < state.closes.length; i++) {
    const c = state.closes[i]!;
    if (c > top) top = c;
  }
  return top;
}

/** Perpindahan dari `from` ke `to`, dalam bps (bertanda, dibulatkan ke nol). */
function moveBps(from: bigint, to: bigint): bigint {
  return ((to - from) * 10000n) / from;
}

/** True bila bar terakhir adalah bar pembalikan: hijau dan naik dari bar lalu. */
function isReversalBar(): boolean {
  const n = state.closes.length;
  if (n < 2) return false;
  const open = state.opens[n - 1]!;
  const close = state.closes[n - 1]!;
  const prevClose = state.closes[n - 2]!;
  return close > open && close > prevClose;
}

/** Alasan keluar ('TP' | 'SL' | 'HOLD') atau '' bila posisi dipertahankan. */
function exitReason(gainBps: bigint): string {
  if (gainBps >= TAKE_PROFIT) return 'TP';
  if (gainBps <= -STOP_LOSS) return 'SL';
  if (state.heldBars >= MAX_HOLD) return 'HOLD';
  return '';
}

/** Order beli seluruh kas, atau [] bila tak layak. */
function buyAll(market: BarsState): BuyInput[] {
  const minNotional = BigInt(market.hello.fees.min_notional_quote_units);
  let spend = market.cash;
  const room = market.weightRoom(ASSET);
  if (spend > room) spend = room;
  if (spend < minNotional) return [];
  return [{ side: 'buy', symbol: ASSET, notional_quote_units: spend, max_slippage_bps: SLIP } satisfies BuyInput];
}

/** Order jual seluruh posisi yang dipegang. */
function sellAll(heldQty: bigint): SellInput[] {
  return [{ side: 'sell', symbol: ASSET, qty: heldQty, max_slippage_bps: SLIP } satisfies SellInput];
}

await runBars({
  onBatch(market: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === ASSET) {
        state.opens.push(BigInt(bar.o));
        state.closes.push(BigInt(bar.c));
      }
    }
    const close = state.closes[state.closes.length - 1];
    if (close === undefined) return [];

    // Lipat fill: beli mengisi harga masuk dan umur posisi,
    // jual menutup posisi.
    for (const f of batch.fills) {
      if (f.symbol !== ASSET || f.status !== 'filled' || f.client_id.startsWith('_')) continue;
      if (f.side === 'buy') {
        state.entryFill = BigInt(f.price);
        state.heldBars = 0;
        state.buys += 1;
      } else {
        state.entryFill = 0n;
        state.heldBars = 0;
      }
    }

    if (market.warmingUp) return [];
    if (state.closes.length <= WINDOW) return [];

    const held = market.positions.get(ASSET);

    // Memegang posisi: periksa tiga pintu keluar, berurutan.
    if (held !== undefined && held.qty > 0n) {
      if (state.entryFill === 0n) state.entryFill = close;
      state.heldBars += 1;
      if (exitReason(moveBps(state.entryFill, close)) !== '') return sellAll(held.qty);
      return [];
    }

    // Flat: masuk hanya bila jurang dalam DAN bar ini bar pembalikan.
    if (state.buys >= MAX_BUYS) return [];
    const peak = rollingPeak();
    if (peak === 0n) return [];
    const dip = ((peak - close) * 10000n) / peak;
    if (dip < DIP) return [];
    if (!isReversalBar()) return [];
    return buyAll(market);
  },
});
