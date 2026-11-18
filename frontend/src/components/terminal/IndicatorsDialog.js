import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Switch } from "../ui/switch";
import { EPOCH_SCHEMA, EPOCH_DEFAULTS } from "../../lib/epoch";
import { CAKMA_SCHEMA, CAKMA_DEFAULTS } from "../../lib/cakma";

function Field({ f, value, onChange, prefix }) {
  const [key, label, type, opts] = f;
  const id = `${prefix}-${key}`;
  if (type === "bool") return <Switch checked={!!value} onCheckedChange={onChange} data-testid={`ind-${id}`} />;
  if (type === "color") return <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 bg-transparent border border-white/10 cursor-pointer" data-testid={`ind-${id}`} />;
  if (type === "select") return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-7 bg-[#141414] border border-white/10 text-xs text-[#E0E3EB] px-1" data-testid={`ind-${id}`}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <input type="number" step={type === "float" ? 0.05 : 1} min={type === "float" ? 0 : 1} defaultValue={value} key={`${id}-${value}`}
      onBlur={(e) => { const v = type === "float" ? parseFloat(e.target.value) : parseInt(e.target.value, 10); if (!Number.isNaN(v) && v >= 0) onChange(v); }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-7 w-20 bg-[#141414] border border-white/10 text-xs text-right font-mono-num text-[#E0E3EB] px-1.5 outline-none focus:border-white/40" data-testid={`ind-${id}`} aria-label={label} />
  );
}

function Settings({ schema, cfg, defaults, onChange, prefix, title }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border border-white/10 px-3 py-2 bg-[#141414]">
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-3">
          <button onClick={() => onChange({ ...defaults, enabled: cfg.enabled })} className="text-[11px] text-[#787B86] hover:text-[#E0E3EB]" data-testid={`ind-${prefix}-reset`}>Varsayılana dön</button>
          <Switch checked={!!cfg.enabled} onCheckedChange={(v) => onChange({ ...cfg, enabled: v })} data-testid={`ind-${prefix}-enabled`} />
        </div>
      </div>
      {schema.map(([group, fields]) => (
        <div key={group}>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[#787B86] mb-1.5">{group}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {fields.map((f, i) => (
              <label key={f[0]} className="flex items-center justify-between gap-2 min-h-[30px]">
                <span className="text-xs text-[#E0E3EB]">{f[1] || `${fields[i - 1]?.[1] || group} rengi`}</span>
                <Field f={f} prefix={prefix} value={cfg[f[0]]} onChange={(v) => onChange({ ...cfg, [f[0]]: v })} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IndicatorsDialog({ open, onOpenChange, epoch, cakma, setEpoch, setCakma }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0A0A0A] border-white/10 text-[#E0E3EB] p-0 gap-0 max-h-[88vh] flex flex-col" data-testid="indicators-dialog">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
          <DialogTitle className="text-base font-bold tracking-tight">Göstergeler</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="epoch" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="bg-transparent justify-start rounded-none border-b border-white/10 px-5 h-10 gap-4">
            <TabsTrigger value="epoch" className="rounded-none px-0 h-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white text-[#787B86]" data-testid="ind-tab-epoch">Epoch Script</TabsTrigger>
            <TabsTrigger value="cakma" className="rounded-none px-0 h-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white text-[#787B86]" data-testid="ind-tab-cakma">CakmaUstad RSI</TabsTrigger>
          </TabsList>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <TabsContent value="epoch" className="mt-0"><Settings schema={EPOCH_SCHEMA} cfg={epoch} defaults={EPOCH_DEFAULTS} onChange={setEpoch} prefix="epoch" title="Epoch Script (grafik üstü)" /></TabsContent>
            <TabsContent value="cakma" className="mt-0"><Settings schema={CAKMA_SCHEMA} cfg={cakma} defaults={CAKMA_DEFAULTS} onChange={setCakma} prefix="cakma" title="CakmaUstad RSI (alt panel)" /></TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
