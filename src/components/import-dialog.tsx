'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/api-client'
import { mapSheet, parseCsv, templateCsv, type ImportColumn } from '@/lib/import-columns'
import { toast } from '@/lib/toast'
import { importService } from '@/modules/admin'
import type { ImportResult } from '@/types/admin.types'
import { PasswordInput } from '@/components/password-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Field } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table'

const MAX_ROWS = 2000

type Parsed = { fileName: string; rows: Record<string, unknown>[]; ignored: string[]; missing: ImportColumn[] }

async function readFile(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    return (await readSheet(file)) as unknown[][]
  }
  if (/\.(csv|txt)$/i.test(file.name)) return parseCsv(await file.text())
  throw new Error('Choose an Excel (.xlsx) or CSV file. Older .xls files must be saved as .xlsx first.')
}

/** Bulk-creates students or teachers from an Excel/CSV file: upload → check → import. */
export function ImportDialog({
  open,
  onOpenChange,
  kind,
  columns,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'students' | 'teachers'
  columns: ImportColumn[]
  onImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [password, setPassword] = useState('')
  const [check, setCheck] = useState<ImportResult | null>(null)
  const [done, setDone] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const noun = kind === 'students' ? 'student' : 'teacher'

  const reset = () => {
    setParsed(null)
    setCheck(null)
    setDone(null)
    setError('')
    setPassword('')
  }

  const close = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const load = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setCheck(null)
    try {
      const sheet = await readFile(file)
      const { rows, ignoredHeaders, missingColumns } = mapSheet(sheet, columns)
      if (!rows.length) throw new Error('The file has a header row but no data rows.')
      if (rows.length > MAX_ROWS) throw new Error(`The file has ${rows.length} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time.`)
      setParsed({ fileName: file.name, rows, ignored: ignoredHeaders, missing: missingColumns })
    } catch (err) {
      setParsed(null)
      setError(errorMessage(err, 'Could not read the file.'))
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const run = async (validateOnly: boolean) => {
    if (!parsed) return
    if (password.length < 8) return setError('Choose an initial password of at least 8 characters.')
    setError('')
    setBusy(true)
    try {
      const result = await importService.run(kind, parsed.rows, { password, validateOnly })
      if (validateOnly) setCheck(result)
      else {
        setDone(result)
        if (result.created) {
          toast.success(`Imported ${result.created} ${noun}${result.created === 1 ? '' : 's'}`, result.failed ? `${result.failed} rows skipped` : undefined)
          onImported()
        }
      }
    } catch (err) {
      setError(errorMessage(err, 'The import failed.'))
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv(columns)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${kind}-import-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const result = done ?? check
  const validCount = check ? check.total - check.failed : 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg">
        <DialogHeader
          icon={<FileSpreadsheet />}
          title={`Import ${kind}`}
          description={`Create many ${kind} at once from an Excel (.xlsx) or CSV file. Each row becomes an account.`}
        />
        <DialogBody className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {done ? (
            <Alert tone={done.failed ? 'warning' : 'success'} title={`${done.created} ${noun}${done.created === 1 ? '' : 's'} created`}>
              {done.failed ? `${done.failed} row${done.failed === 1 ? ' was' : 's were'} skipped — see below.` : 'Every row was imported.'} They can sign in with the
              initial password you chose and change it from their profile.
            </Alert>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Required columns: <span className="font-medium text-foreground">{columns.filter((c) => c.required).map((c) => c.label).join(', ')}</span>
                </span>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download /> Template
                </Button>
              </div>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  load(e.dataTransfer.files[0])
                }}
                className={cn(
                  'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/40'
                )}
              >
                <Upload className="size-6 text-primary" />
                {parsed ? (
                  <>
                    <span className="font-medium">{parsed.fileName}</span>
                    <span className="text-sm text-muted-foreground">
                      {parsed.rows.length} data row{parsed.rows.length === 1 ? '' : 's'} · click to choose another file
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-medium">Drop a file here or click to browse</span>
                    <span className="text-sm text-muted-foreground">.xlsx or .csv · first row must be the column headers · up to {MAX_ROWS.toLocaleString()} rows</span>
                  </>
                )}
              </button>
              <input ref={inputRef} type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => load(e.target.files?.[0])} />

              {parsed && parsed.missing.length > 0 && (
                <Alert tone="danger" title="Missing required columns">
                  {parsed.missing.map((c) => c.label).join(', ')}. Add them to the header row (see the template).
                </Alert>
              )}
              {parsed && parsed.ignored.length > 0 && (
                <Alert tone="info">Ignored columns: {parsed.ignored.join(', ')}</Alert>
              )}

              {parsed && parsed.missing.length === 0 && (
                <Field label="Initial password for every imported account" htmlFor="import-password" hint="At least 8 characters. Share it with the users; they can change it after signing in.">
                  <PasswordInput
                    id="import-password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setCheck(null)
                    }}
                  />
                </Field>
              )}

              {check && (
                <Alert tone={check.failed ? 'warning' : 'success'} title={`${validCount} of ${check.total} rows ready to import`}>
                  {check.failed ? `${check.failed} row${check.failed === 1 ? ' has' : 's have'} problems and will be skipped. Fix them in the file and re-upload, or import the valid rows now.` : 'No problems found.'}
                </Alert>
              )}
            </>
          )}

          {result && result.errors.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border scrollbar-thin">
              <Table>
                <THead className="sticky top-0 bg-muted">
                  <tr>
                    <TH className="w-20">Row</TH>
                    <TH>Problem</TH>
                  </tr>
                </THead>
                <TBody>
                  {result.errors.map((e) => (
                    <TR key={e.row}>
                      <TD className="tabular-nums">
                        <AlertTriangle className="mr-1 inline size-3.5 text-warning" />
                        {/* +1 for the header row so it matches the spreadsheet's row number */}
                        {e.row + 1}
                      </TD>
                      <TD className="text-sm">{e.message}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {done ? (
            <Button onClick={() => close(false)}>
              <CheckCircle2 /> Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              {!check ? (
                <Button onClick={() => run(true)} loading={busy} disabled={!parsed || parsed.missing.length > 0 || password.length < 8}>
                  Check file
                </Button>
              ) : (
                <Button onClick={() => run(false)} loading={busy} disabled={validCount === 0}>
                  <Upload /> Import {validCount} {noun}
                  {validCount === 1 ? '' : 's'}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
