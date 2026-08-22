from pathlib import Path

def restyle(path: Path):
    text = path.read_text(encoding='utf-8')
    bulk = [
        ("const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-reception outline-none text-sm font-medium text-slate-700'",
         "const inputCls = 'w-full px-3 py-2 rounded-rd border border-rd-border bg-rd-surface focus:border-rd-primary outline-none text-sm font-medium text-rd-text'"),
        ("bg-emerald-50 text-emerald-700", "bg-rd-good-bg text-rd-good"),
        ("bg-rose-50 text-rose-600", "bg-rd-critical-bg text-rd-critical"),
        ("bg-emerald-500", "bg-rd-good"),
        ("bg-rose-500", "bg-rd-critical"),
        ("bg-indigo-50 text-indigo-700", "bg-rd-info-bg text-rd-info"),
        ("bg-amber-50 text-amber-700", "bg-rd-pending-bg text-rd-pending"),
        ("bg-sky-50 text-sky-700", "bg-rd-info-bg text-rd-info"),
        ("bg-teal-50 text-teal-700", "bg-rd-good-bg text-rd-good"),
        ("bg-indigo-500", "bg-rd-info"),
        ("bg-amber-500", "bg-rd-pending"),
        ("hover:bg-emerald-600", "hover:opacity-90"),
        ("hover:bg-amber-600", "hover:opacity-90"),
        ("bg-white rounded-2xl shadow-2xl", "rd-panel"),
        ("bg-white rounded-2xl border border-slate-100 shadow-sm", "rd-panel"),
        ("bg-white rounded-2xl border border-slate-200 shadow-sm", "rd-panel"),
        ("bg-white rounded-2xl border border-slate-200", "rd-panel"),
        ("bg-white rounded-xl border border-slate-200 shadow-sm", "rd-panel"),
        ("bg-white rounded-xl border border-slate-200", "rd-panel"),
        ("bg-white p-4 rounded-2xl border border-slate-100 shadow-sm", "rd-panel p-4"),
        ("bg-reception text-white", "bg-rd-primary text-white"),
        ("hover:bg-blue-700", "hover:bg-rd-primary-hover"),
        ("text-reception", "text-rd-primary"),
        ("border-reception", "border-rd-primary"),
        ("bg-reception/10", "bg-rd-info-bg"),
        ("hover:bg-reception hover:text-white", "hover:bg-rd-primary hover:text-white"),
        ("font-black", "font-bold"),
        ("bg-blue-500", "bg-rd-info"),
        ("bg-blue-50", "bg-rd-info-bg"),
        ("bg-amber-400", "bg-rd-pending"),
        ("bg-amber-50 border border-amber-200", "bg-rd-pending-bg border border-rd-pending"),
        ("text-amber-700", "text-rd-pending"),
        ("bg-amber-50", "bg-rd-pending-bg"),
        ("rounded-full", "rounded-rd-sm"),
        ("rounded-2xl", "rounded-rd"),
        ("rounded-xl", "rounded-rd"),
        ("rounded-lg", "rounded-rd"),
        (" shadow-sm", ""),
        (" shadow-md", ""),
        (" shadow-2xl", ""),
        ("bg-slate-50", "bg-rd-canvas"),
        ("bg-slate-100", "bg-rd-info-bg"),
        ("text-slate-800", "text-rd-text"),
        ("text-slate-700", "text-rd-text"),
        ("text-slate-600", "text-rd-muted"),
        ("text-slate-500", "text-rd-muted"),
        ("text-slate-400", "text-rd-muted"),
        ("border-slate-200", "border-rd-border"),
        ("border-slate-100", "border-rd-border"),
        ("divide-slate-100", "divide-rd-border"),
        ("hover:bg-slate-50", "hover:bg-rd-info-bg"),
        ("hover:bg-slate-100", "hover:bg-rd-info-bg"),
        ("bg-white ", "bg-rd-surface "),
        ("bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100", "border border-rd-border bg-rd-info-bg"),
        ("from-blue-600 to-indigo-600", "bg-rd-primary"),
        ("bg-gradient-to-r ", ""),
        ("focus:border-reception", "focus:border-rd-primary"),
        ("bg-rose-50/30", "bg-rd-critical-bg/40"),
        ("hover:bg-rose-50/60", "hover:bg-rd-critical-bg"),
        ("bg-violet-50", "bg-rd-pending-bg"),
        ("text-violet-700", "text-rd-pending"),
        ("bg-emerald-50", "bg-rd-good-bg"),
        ("text-emerald-700", "text-rd-good"),
        ("text-emerald-600", "text-rd-good"),
        ("animate-pulse", ""),
    ]
    for a, b in bulk:
        text = text.replace(a, b)

    # btnCls patterns that vary
    text = text.replace(
        "rounded-xl text-sm font-bold transition-all ${active ? 'bg-rd-primary text-white' : 'bg-rd-surface text-rd-muted border border-rd-border hover:bg-rd-info-bg'}",
        "rounded-rd text-sm font-semibold transition-[background-color,color] duration-100 ${active ? 'rd-btn-primary' : 'rd-btn-secondary'}",
    )
    text = text.replace(
        "px-5 py-2.5 rounded-rd text-sm font-bold transition-all ${active ? 'bg-rd-primary text-white' : 'bg-rd-surface text-rd-muted border border-rd-border hover:bg-rd-info-bg'}",
        "px-4 py-2 rounded-rd text-sm font-semibold transition-[background-color,color] duration-100 ${active ? 'rd-btn-primary' : 'rd-btn-secondary'}",
    )
    path.write_text(text, encoding='utf-8')
    print(f'Updated {path.name}')

base = Path(r'c:/Users/vemul/Downloads/PMS FNL 2-1/PMS FNL 2/admin/src/pages/Reception')
for name in [
    'TodaysOperations.jsx',
    'Patients.jsx',
    'Payments.jsx',
    'RefundRequests.jsx',
    'Reports.jsx',
    'Settings.jsx',
    'FollowUps.jsx',
    'NoShows.jsx',
    'ConsultationSummary.jsx',
    'OnlineBookings.jsx',
    'QueueManagement.jsx',
    'WalkInRegistration.jsx',
    'QRCheckIn.jsx',
]:
    p = base / name
    if p.exists():
        restyle(p)
    else:
        print('missing', name)
