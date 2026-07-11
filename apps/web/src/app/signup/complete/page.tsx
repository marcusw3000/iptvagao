import Link from 'next/link'
import { CheckCircle2, CreditCard, ShieldCheck, Sparkles } from 'lucide-react'

const nextSteps = [
  {
    title: 'Pagamento recebido',
    description: 'Se a operadora confirmou a cobranca, a assinatura ja pode seguir para liberacao normal no sistema.',
    icon: CheckCircle2,
    tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Acesse com suas credenciais',
    description: 'Use o login criado no cadastro para entrar e acompanhar sua assinatura e dispositivos.',
    icon: ShieldCheck,
    tone: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  },
  {
    title: 'Precisa refazer o fluxo?',
    description: 'Se quiser cadastrar outro cliente por indicacao, voce pode abrir um novo cadastro publico.',
    icon: CreditCard,
    tone: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  },
]

export default function SignupCompletePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gray-950 px-4 py-10 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_28%)]"
      />

      <div className="relative mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gray-900/80 shadow-[0_24px_80px_rgba(3,7,18,0.55)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-200">
                <Sparkles size={14} />
                Pagamento processado
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
                Assinatura concluida
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">
                O checkout terminou e o retorno agora acontece em uma rota publica mais limpa. Se o pagamento foi aprovado,
                o acesso ja pode ser usado com as credenciais exibidas no cadastro.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Ir para login
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-700 bg-gray-950/70 px-5 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-900"
                >
                  Novo cadastro
                </Link>
              </div>
            </div>

            <aside className="bg-gradient-to-br from-gray-900 via-gray-950 to-indigo-950/70 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">Proximos passos</p>
              <div className="mt-5 space-y-4">
                {nextSteps.map((step) => {
                  const Icon = step.icon
                  return (
                    <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                      <div className={`inline-flex rounded-xl border p-2 ${step.tone}`}>
                        <Icon size={18} />
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-white">{step.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-300">{step.description}</p>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  )
}
