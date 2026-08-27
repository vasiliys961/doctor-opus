const TRONSCAN_TX_API = 'https://apilist.tronscanapi.com/api/transaction-info'
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

interface VerifyInput {
  txHash: string
  toAddress: string
  expectedAmountUsdt: number
}

interface VerifyResult {
  ok: boolean
  reason?: string
  confirmed?: boolean
  fromAddress?: string
  amountUsdt?: number
}

function parseAmountUsdt(transfer: any): number {
  const amountStr = String(transfer?.amount_str || '').trim()
  if (amountStr) {
    const parsed = Number.parseFloat(amountStr.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const raw = String(
    transfer?.quant ??
      transfer?.amount ??
      transfer?.value ??
      transfer?.amount_raw ??
      ''
  ).trim()
  const rawNum = Number.parseFloat(raw)
  if (!Number.isFinite(rawNum) || rawNum <= 0) return 0

  const decimalsRaw =
    transfer?.decimals ??
    transfer?.tokenInfo?.tokenDecimal ??
    transfer?.tokenInfo?.tokenDecimalStr ??
    6
  const decimals = Number.parseInt(String(decimalsRaw), 10)
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 18) return rawNum
  return rawNum / Math.pow(10, decimals)
}

function normalizeAddress(value: unknown): string {
  return String(value || '').trim()
}

export async function verifyUsdtTrc20Transfer(input: VerifyInput): Promise<VerifyResult> {
  const txHash = input.txHash.trim()
  const toAddress = input.toAddress.trim()
  const expectedAmount = Number(input.expectedAmountUsdt.toFixed(2))

  const url = `${TRONSCAN_TX_API}?hash=${encodeURIComponent(txHash)}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    return { ok: false, reason: `Unable to fetch transaction (${response.status})` }
  }

  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'Invalid transaction payload from TRON API' }
  }

  const confirmed =
    payload.confirmed === true ||
    String(payload.contractRet || '').toUpperCase() === 'SUCCESS'

  const transferRows = Array.isArray(payload.trc20TransferInfo)
    ? payload.trc20TransferInfo
    : Array.isArray(payload.tokenTransferInfo)
      ? payload.tokenTransferInfo
      : []

  if (transferRows.length === 0) {
    return { ok: false, reason: 'No TRC20 transfers found in transaction', confirmed }
  }

  for (const transfer of transferRows) {
    const contractAddress = normalizeAddress(
      transfer?.contract_address || transfer?.contractAddress || transfer?.tokenInfo?.tokenId
    )
    const symbol = String(
      transfer?.symbol || transfer?.tokenAbbr || transfer?.tokenInfo?.tokenAbbr || ''
    ).toUpperCase()
    const isUsdt = contractAddress === USDT_TRC20_CONTRACT || symbol === 'USDT'
    if (!isUsdt) continue

    const incomingTo = normalizeAddress(
      transfer?.to_address || transfer?.toAddress || transfer?.to || transfer?.to_addr
    )
    if (incomingTo !== toAddress) continue

    const amountUsdt = parseAmountUsdt(transfer)
    if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
      return { ok: false, reason: 'Unable to parse USDT amount in transaction', confirmed }
    }

    if (!confirmed) {
      return {
        ok: false,
        reason: 'Transaction found but not confirmed yet',
        confirmed: false,
        amountUsdt,
        fromAddress: normalizeAddress(
          transfer?.from_address || transfer?.fromAddress || transfer?.from || transfer?.from_addr
        ),
      }
    }

    // Accept exact amount or overpayment; allow 0.01 rounding tolerance.
    if (amountUsdt + 0.01 < expectedAmount) {
      return {
        ok: false,
        reason: `Received amount is lower than expected (${amountUsdt.toFixed(2)} < ${expectedAmount.toFixed(2)})`,
        confirmed: true,
        amountUsdt,
        fromAddress: normalizeAddress(
          transfer?.from_address || transfer?.fromAddress || transfer?.from || transfer?.from_addr
        ),
      }
    }

    return {
      ok: true,
      confirmed: true,
      amountUsdt,
      fromAddress: normalizeAddress(
        transfer?.from_address || transfer?.fromAddress || transfer?.from || transfer?.from_addr
      ),
    }
  }

  return {
    ok: false,
    reason: 'USDT transfer to expected wallet was not found in this transaction',
    confirmed,
  }
}
