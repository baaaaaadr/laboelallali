'use client';

/**
 * The "Tableau de bord" tab of /admin — adoption steering for the online-results
 * service. **Admin & owner only** (the front-desk relance tool lives in its own
 * `RelancesTab`, which staff can reach).
 *
 * Narrative order, validated with the lab director on the mockup:
 *   1. key figures + this month          5. where it breaks (funnel, freshness)
 *   2. oldest pending request (action)   6. who uses it (age, frequency, type)
 *   3. usage gauge + scope note          7. team responsiveness
 *   4. evolution over time (growth)      8. relances & acquisition
 *   9. collapsed detail lists
 *
 * Charts read metadata only — counts and dates. No result, no medical value ever
 * reaches this screen.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, User, CheckCircle, Inbox, Activity, TrendingUp, Clock,
  AlertTriangle, UserPlus, ChevronDown,
} from 'lucide-react';
import { AreaChart, VBars, HBars, StackedBar, ChartCard, StatBig } from './charts';

export interface DashAccount {
  uid: string;
  fullName: string;
  email: string;
  createdAt?: string;
  hasAccess?: boolean;
  lastResultsAt?: number | null;
}

export interface DashboardStats {
  totals: {
    accounts: number; withAccess: number; withoutAccess: number;
    pendingRequests: number; byType: Record<string, number>;
  };
  usage: { active: number; dormant: number; rate: number; windowDays: number };
  growth: { months: { key: string; created: number; cumulative: number }[] };
  monthDelta: { current: number; previous: number; pct: number };
  funnel: { created: number; activated: number; consulted: number };
  freshness: { d7: number; d30: number; d90: number; older: number; never: number };
  ages: { key: string; total: number; active: number; rate: number }[];
  frequency: { once: number; f2_5: number; f6_15: number; f16: number };
  firstView: { avgDays: number; overWeekPct: number; sample: number };
  relance: { relanced: number; returned: number; rate: number; windowDays: number };
  activation: { avgDays: number; sample: number; weeks: { label: string; avgDays: number; n: number }[] };
  requests: {
    fulfilled: number; rejected: number; pending: number;
    oldestPendingDays: number | null; oldestPendingName: string;
  };
  team: { uid: string; name: string; count: number }[];
  weekly: { label: string; consultations: number }[];
  shares: { month: number; signups: number };
  latestCreated: DashAccount[];
  latestActive: DashAccount[];
  truncated: boolean;
  teamAccounts: number;
  includeTeam: boolean;
}

interface Props {
  dash: DashboardStats;
  isArabic: boolean;
  usageSince: string;
  includeTeam: boolean;
  onToggleTeam: (v: boolean) => void;
  openSec: Record<string, boolean>;
  onToggleSec: (key: string) => void;
  fmtDate: (iso: string) => string;
  fmtWhen: (ms?: number | null) => string;
}

export default function AdminDashboard({
  dash, isArabic, usageSince, includeTeam, onToggleTeam,
  openSec, onToggleSec, fmtDate, fmtWhen,
}: Props) {
  const { t } = useTranslation('common');

  /** Localized month label ("juil. 26") for the growth curve. */
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(isArabic ? 'ar-MA' : 'fr-FR', { month: 'short' });
  };

  const collecting = t('admin.dash_collecting', {
    date: fmtDate(usageSince),
    defaultValue: 'Collecte en cours depuis le {{date}} — les données apparaîtront progressivement.',
  });

  /** Collapsible header for the detail lists at the bottom. */
  const secHeader = (
    key: string,
    label: string,
    count: number,
    Icon: React.ComponentType<{ size?: number; className?: string }>
  ) => {
    const open = !!openSec[key];
    return (
      <button
        type="button"
        onClick={() => onToggleSec(key)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-start"
      >
        <span className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 min-w-0">
          <Icon size={20} className="text-[var(--color-bordeaux-primary)] flex-shrink-0" />
          {label}
        </span>
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[var(--background-secondary)] text-[var(--text-secondary)] tabular-nums">
            {count}
          </span>
          <ChevronDown
            size={18}
            className={`text-[var(--color-bordeaux-primary)] transition-transform ${open ? '' : isArabic ? 'rotate-90' : '-rotate-90'}`}
          />
        </span>
      </button>
    );
  };

  const sectionTitle = (title: string, desc: string) => (
    <div className="pt-2">
      <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm text-[var(--text-secondary)] mt-0.5">{desc}</p>
    </div>
  );

  const tiles = [
    { icon: Users, label: t('admin.dash_accounts', 'Comptes patients'), value: dash.totals.accounts, sub: '' },
    {
      icon: CheckCircle, label: t('admin.dash_with_access', 'Accès activé'), value: dash.totals.withAccess,
      sub: dash.totals.accounts ? `${Math.round((dash.totals.withAccess / dash.totals.accounts) * 100)} %` : '',
    },
    { icon: User, label: t('admin.dash_without_access', 'Sans accès'), value: dash.totals.withoutAccess, sub: '' },
    { icon: Inbox, label: t('admin.dash_pending', 'Demandes en attente'), value: dash.totals.pendingRequests, sub: '' },
    {
      icon: TrendingUp, label: t('admin.dash_this_month', 'Ce mois-ci'),
      value: dash.monthDelta.current,
      sub: dash.monthDelta.previous
        ? t('admin.dash_vs_prev', { pct: dash.monthDelta.pct, defaultValue: '{{pct}} % vs mois dernier' })
        : '',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1 — Key figures */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {tiles.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <Icon size={14} className="text-[var(--color-bordeaux-primary)] flex-shrink-0" />
              <span className="leading-tight">{label}</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
            {sub && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* 2 — Oldest pending request: the one thing to act on today */}
      {dash.requests.oldestPendingDays !== null && dash.requests.oldestPendingDays >= 2 && (
        <div className="card p-4 flex items-start gap-3 border-l-4 border-l-[var(--status-warning)]">
          <AlertTriangle size={20} className="text-[var(--status-warning)] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)]">
            <b className="text-[var(--text-primary)]">
              {t('admin.dash_oldest_pending', {
                days: dash.requests.oldestPendingDays,
                defaultValue: 'Demande en attente depuis {{days}} jours',
              })}
            </b>
            {dash.requests.oldestPendingName ? ` — ${dash.requests.oldestPendingName}. ` : '. '}
            {t('admin.dash_oldest_pending_hint', "Activez son accès pour ne pas laisser le patient sans réponse.")}
          </p>
        </div>
      )}

      {/* 3 — Usage gauge + scope */}
      <div className="card p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Activity size={20} className="text-[var(--color-bordeaux-primary)]" />
            {t('admin.dash_usage_title', "Taux d'utilisation")}
          </h2>
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{dash.usage.rate} %</span>
        </div>
        <div className="h-2.5 rounded-lg bg-[var(--background-secondary)] overflow-hidden">
          <div className="h-full rounded-lg bg-[var(--color-fuchsia-accent)]" style={{ width: `${Math.min(100, Math.max(0, dash.usage.rate))}%` }} />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          {t('admin.dash_usage_desc', {
            active: dash.usage.active, total: dash.totals.withAccess,
            days: dash.usage.windowDays, dormant: dash.usage.dormant,
            defaultValue: '{{active}} comptes actifs sur {{total}} accès activés (sur {{days}} jours) — {{dormant}} dormants.',
          })}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-[var(--text-tertiary)] flex items-start gap-1.5 min-w-0">
            <Users size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              {dash.includeTeam
                ? t('admin.dash_team_included', { n: dash.teamAccounts, defaultValue: "Les {{n}} comptes de l'équipe sont inclus dans ces chiffres." })
                : t('admin.dash_team_excluded', { n: dash.teamAccounts, defaultValue: "Les {{n}} comptes de l'équipe (dont le vôtre) sont exclus — ce sont les chiffres patients." })}
            </span>
          </p>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={includeTeam}
              onChange={(e) => onToggleTeam(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-fuchsia-accent)] cursor-pointer"
            />
            {t('admin.dash_include_team', "Inclure les comptes de l'équipe")}
          </label>
        </div>
      </div>

      {/* 4 — Evolution over time */}
      {sectionTitle(
        t('admin.dash_sec_time', "Évolution dans le temps"),
        t('admin.dash_sec_time_desc', "Est-ce que le service prend, et à quelle vitesse ?")
      )}

      <ChartCard
        title={t('admin.dash_growth_title', 'Croissance des comptes')}
        subtitle={t('admin.dash_growth_sub', 'Nombre total de patients inscrits, mois après mois')}
        hint={t('admin.dash_growth_hint', "Voir si l'adoption accélère ou stagne, et mesurer l'effet de vos actions (affiche à l'accueil, bouche-à-oreille, formation des stagiaires).")}
      >
        <AreaChart
          points={dash.growth.months.map((m) => ({ label: monthLabel(m.key), value: m.cumulative }))}
          ariaLabel={t('admin.dash_growth_title', 'Croissance des comptes')}
          emptyLabel={collecting}
        />
      </ChartCard>

      <ChartCard
        title={t('admin.dash_weekly_title', 'Activité semaine par semaine')}
        subtitle={t('admin.dash_weekly_sub', 'Nombre de consultations de résultats, par semaine')}
        hint={t('admin.dash_weekly_hint', "C'est la courbe de vie du service : elle dit si les patients prennent l'habitude de consulter, et signale un décrochage au moment où il se produit. Simple comptage global, rattaché à personne.")}
      >
        <VBars
          bars={dash.weekly.map((w) => ({ label: w.label, value: w.consultations }))}
          ariaLabel={t('admin.dash_weekly_title', 'Activité semaine par semaine')}
          emptyLabel={collecting}
        />
      </ChartCard>

      {/* 5 — Where it breaks */}
      {sectionTitle(
        t('admin.dash_sec_block', 'Où ça bloque'),
        t('admin.dash_sec_block_desc', "Pourquoi tout le monde n'utilise-t-il pas le service ?")
      )}

      <ChartCard
        title={t('admin.dash_funnel_title', 'Le parcours patient, étape par étape')}
        subtitle={t('admin.dash_funnel_sub', "De l'inscription à l'utilisation réelle")}
        hint={t('admin.dash_funnel_hint', "Montre exactement où on perd les patients. Beaucoup d'inscrits mais peu d'accès activés → c'est l'accueil qu'il faut outiller. Beaucoup d'accès mais peu de consultations → ce sont les patients qu'il faut accompagner.")}
      >
        <HBars
          rows={[
            { label: t('admin.dash_funnel_created', 'Comptes créés'), value: dash.funnel.created, display: String(dash.funnel.created) },
            { label: t('admin.dash_funnel_activated', 'Accès activés'), value: dash.funnel.activated, display: String(dash.funnel.activated) },
            { label: t('admin.dash_funnel_consulted', 'Ont consulté'), value: dash.funnel.consulted, display: String(dash.funnel.consulted) },
          ]}
          ariaLabel={t('admin.dash_funnel_title', 'Le parcours patient')}
          emptyLabel={collecting}
        />
      </ChartCard>

      <ChartCard
        title={t('admin.dash_fresh_title', 'Santé de la base patients')}
        subtitle={t('admin.dash_fresh_sub', 'Depuis combien de temps chaque patient a consulté')}
        hint={t('admin.dash_fresh_hint', "Plus fin que « actif ou dormant » : la zone orange, ce sont les patients en train de se désengager — ceux à relancer avant qu'ils décrochent pour de bon.")}
      >
        <StackedBar
          segments={[
            { label: t('admin.dash_fresh_d7', 'Moins de 7 j'), value: dash.freshness.d7, color: 'var(--status-success)' },
            { label: t('admin.dash_fresh_d30', '7 à 30 j'), value: dash.freshness.d30, color: 'var(--color-fuchsia-accent)' },
            { label: t('admin.dash_fresh_d90', '30 à 90 j'), value: dash.freshness.d90, color: 'var(--status-warning)' },
            { label: t('admin.dash_fresh_older', 'Plus de 90 j'), value: dash.freshness.older, color: 'var(--color-bordeaux-primary)' },
            { label: t('admin.dash_fresh_never', 'Jamais'), value: dash.freshness.never, color: 'var(--text-tertiary)' },
          ]}
          ariaLabel={t('admin.dash_fresh_title', 'Santé de la base patients')}
          emptyLabel={collecting}
        />
      </ChartCard>

      {/* 6 — Who uses it */}
      {sectionTitle(
        t('admin.dash_sec_who', 'Qui utilise le service'),
        t('admin.dash_sec_who_desc', "Pour cibler l'accompagnement là où il manque vraiment.")
      )}

      <ChartCard
        title={t('admin.dash_age_title', "Utilisation selon l'âge")}
        subtitle={t('admin.dash_age_sub', 'Part des patients qui consultent, par tranche d’âge')}
        hint={t('admin.dash_age_hint', "Répond à la vraie question : est-ce que nos patients âgés y arrivent ? Si les plus de 60 ans décrochent, ce n'est pas l'application qu'il faut changer mais l'accompagnement au comptoir.")}
      >
        <HBars
          rows={dash.ages.map((a) => ({
            label: a.key === '76+' ? t('admin.dash_age_76', 'Plus de 75 ans') : `${a.key} ${t('admin.dash_age_years', 'ans')}`,
            value: a.rate,
            display: `${a.rate} %`,
            warn: a.rate < 40 && a.total > 0,
          }))}
          ariaLabel={t('admin.dash_age_title', "Utilisation selon l'âge")}
          emptyLabel={collecting}
          scaleMax={100}
        />
      </ChartCard>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard
          title={t('admin.dash_freq_title', "Fréquence d'utilisation")}
          subtitle={t('admin.dash_freq_sub', 'Combien de fois chaque patient a consulté')}
          hint={t('admin.dash_freq_hint', "Distingue le patient fidèle de celui qui a ouvert une fois par curiosité. Les « une seule fois » sont la cible prioritaire : ils ont essayé, ils ne sont pas revenus.")}
        >
          <HBars
            rows={[
              { label: t('admin.dash_freq_1', '1 seule fois'), value: dash.frequency.once, display: String(dash.frequency.once) },
              { label: t('admin.dash_freq_2', '2 à 5 fois'), value: dash.frequency.f2_5, display: String(dash.frequency.f2_5) },
              { label: t('admin.dash_freq_6', '6 à 15 fois'), value: dash.frequency.f6_15, display: String(dash.frequency.f6_15) },
              { label: t('admin.dash_freq_16', 'Plus de 15'), value: dash.frequency.f16, display: String(dash.frequency.f16) },
            ]}
            ariaLabel={t('admin.dash_freq_title', "Fréquence d'utilisation")}
            emptyLabel={collecting}
          />
        </ChartCard>

        <ChartCard
          title={t('admin.dash_types_title', 'Types de comptes')}
          subtitle={t('admin.dash_types_sub', 'Patients, médecins et correspondants')}
          hint={t('admin.dash_types_hint', "Discret aujourd'hui, mais essentiel le jour où l'on voudra développer l'accès pour les médecins prescripteurs.")}
        >
          <HBars
            rows={[
              { label: t('admin.type_patient', 'Patient'), value: dash.totals.byType.patient || 0, display: String(dash.totals.byType.patient || 0) },
              { label: t('admin.type_medecin', 'Médecin'), value: dash.totals.byType.medecin || 0, display: String(dash.totals.byType.medecin || 0) },
              { label: t('admin.type_correspondant', 'Correspondant'), value: dash.totals.byType.correspondant || 0, display: String(dash.totals.byType.correspondant || 0) },
            ]}
            ariaLabel={t('admin.dash_types_title', 'Types de comptes')}
            emptyLabel={collecting}
          />
        </ChartCard>
      </div>

      {/* 7 — Team responsiveness */}
      {sectionTitle(
        t('admin.dash_sec_team', "Réactivité de l'équipe"),
        t('admin.dash_sec_team_desc', "Le service ne vaut que par la rapidité avec laquelle l'accueil active les accès.")
      )}

      <ChartCard
        title={t('admin.dash_activation_title', "Délai d'activation des accès")}
        subtitle={t('admin.dash_activation_sub', 'Temps moyen entre la demande du patient et son activation')}
        hint={t('admin.dash_activation_hint', "L'indicateur de qualité de service de l'accueil. Un patient qui attend cinq jours son accès, c'est une promesse non tenue — ici la dérive se voit tout de suite, et le progrès aussi.")}
      >
        {dash.activation.sample > 0 ? (
          <>
            <StatBig
              value={t('admin.dash_days', { n: dash.activation.avgDays, defaultValue: '{{n}} jours' })}
              caption={t('admin.dash_activation_caption', { n: dash.activation.sample, defaultValue: 'Moyenne sur {{n}} demandes traitées' })}
            />
            <div className="mt-4">
              <VBars
                bars={dash.activation.weeks.map((w) => ({ label: w.label, value: w.avgDays }))}
                ariaLabel={t('admin.dash_activation_title', "Délai d'activation")}
                emptyLabel={collecting}
                height={80}
              />
            </div>
          </>
        ) : (
          <StatBig value="—" caption={t('admin.dash_activation_none', 'Aucune demande traitée pour le moment.')} />
        )}
      </ChartCard>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard
          title={t('admin.dash_req_title', 'Devenir des demandes')}
          subtitle={t('admin.dash_req_sub', "Ce que deviennent les demandes d'accès reçues")}
          hint={t('admin.dash_req_hint', "Un taux de refus qui grimpe signale un problème en amont : des patients qui demandent sans comprendre, ou une identité mal vérifiée.")}
        >
          <StackedBar
            segments={[
              { label: t('admin.dash_req_ok', 'Activées'), value: dash.requests.fulfilled, color: 'var(--status-success)' },
              { label: t('admin.dash_req_ko', 'Refusées'), value: dash.requests.rejected, color: 'var(--status-warning)' },
              { label: t('admin.dash_req_wait', 'En attente'), value: dash.requests.pending, color: 'var(--text-tertiary)' },
            ]}
            ariaLabel={t('admin.dash_req_title', 'Devenir des demandes')}
            emptyLabel={collecting}
          />
        </ChartCard>

        <ChartCard
          title={t('admin.dash_team_title', "Activité de l'équipe")}
          subtitle={t('admin.dash_team_sub', 'Accès activés ce mois-ci, par personne')}
          hint={t('admin.dash_team_hint', "Valorise le travail des stagiaires de l'accueil — la première cible du système — et montre qui maîtrise l'outil et qui aurait besoin d'un coup de main.")}
        >
          <HBars
            rows={dash.team.map((m) => ({ label: m.name, value: m.count, display: String(m.count) }))}
            ariaLabel={t('admin.dash_team_title', "Activité de l'équipe")}
            emptyLabel={t('admin.dash_team_none', 'Aucune activation ce mois-ci.')}
          />
        </ChartCard>
      </div>

      {/* 8 — Relances & acquisition */}
      {sectionTitle(
        t('admin.dash_sec_relance', "Relances et acquisition"),
        t('admin.dash_sec_relance_desc', "Relancer, c'est bien. Savoir si ça fonctionne, c'est mieux.")
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <ChartCard
          title={t('admin.dash_relance_title', 'Efficacité des relances')}
          subtitle={t('admin.dash_relance_sub', { days: dash.relance.windowDays, defaultValue: 'Sur les {{days}} derniers jours' })}
          hint={t('admin.dash_relance_hint', "Si le taux de retour est bon, l'effort de l'accueil est rentable ; s'il s'effondre, il faut changer de méthode ou de message.")}
        >
          {dash.relance.relanced > 0 ? (
            <StatBig
              value={t('admin.dash_relance_val', { a: dash.relance.returned, b: dash.relance.relanced, defaultValue: '{{a}} sur {{b}}' })}
              caption={t('admin.dash_relance_caption', { pct: dash.relance.rate, defaultValue: 'patients relancés sont revenus consulter — {{pct}} % de réussite' })}
            />
          ) : (
            <StatBig value="—" caption={t('admin.dash_relance_none', 'Aucune relance enregistrée pour le moment.')} />
          )}
        </ChartCard>

        <ChartCard
          title={t('admin.dash_first_title', 'Délai avant la 1ʳᵉ consultation')}
          subtitle={t('admin.dash_first_sub', "Entre l'activation de l'accès et la première visite")}
          hint={t('admin.dash_first_hint', "Si les patients mettent longtemps à ouvrir l'application après activation, c'est que l'explication au comptoir doit être revue.")}
        >
          {dash.firstView.sample > 0 ? (
            <StatBig
              value={t('admin.dash_days', { n: dash.firstView.avgDays, defaultValue: '{{n}} jours' })}
              caption={t('admin.dash_first_caption', { pct: dash.firstView.overWeekPct, defaultValue: 'en moyenne — {{pct}} % attendent plus d’une semaine' })}
            />
          ) : (
            <StatBig value="—" caption={collecting} />
          )}
        </ChartCard>

        <ChartCard
          title={t('admin.dash_share_title', 'Le bouche-à-oreille')}
          subtitle={t('admin.dash_share_sub', 'Partages du bouton « Faites-en profiter un proche »')}
          hint={t('admin.dash_share_hint', "Mesure le canal de recrutement le moins coûteux qui existe : un patient satisfait qui en amène un autre.")}
        >
          <StatBig
            value={t('admin.dash_share_val', { n: dash.shares.month, defaultValue: '{{n}} partages' })}
            caption={t('admin.dash_share_caption', { n: dash.shares.signups, defaultValue: 'ce mois-ci, qui ont donné {{n}} nouvelles inscriptions' })}
          />
        </ChartCard>
      </div>

      {/* 9 — Detail lists (collapsed) */}
      <div className="card p-6 space-y-4">
        {secHeader('active', t('admin.dash_active_title', 'Derniers comptes actifs'), dash.latestActive.length, Activity)}
        {openSec.active && (dash.latestActive.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t('admin.dash_active_empty', 'Aucune consultation enregistrée pour le moment.')}</p>
        ) : (
          <ul className="divide-y divide-[var(--border-default)]">
            {dash.latestActive.map((a) => (
              <li key={a.uid} className="flex items-center justify-between gap-3 py-3">
                <p className="font-medium text-[var(--text-primary)] truncate min-w-0">{a.fullName || a.email}</p>
                <span className="text-sm text-[var(--text-secondary)] flex-shrink-0">{fmtWhen(a.lastResultsAt)}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <div className="card p-6 space-y-4">
        {secHeader('created', t('admin.dash_new_title', 'Derniers comptes créés'), dash.latestCreated.length, UserPlus)}
        {openSec.created && (
          <ul className="divide-y divide-[var(--border-default)]">
            {dash.latestCreated.map((a) => (
              <li key={a.uid} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">{a.fullName || a.email}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{fmtDate(a.createdAt || '')}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 bg-[var(--background-secondary)] ${a.hasAccess ? 'text-[var(--status-success)]' : 'text-[var(--text-secondary)]'}`}>
                  {a.hasAccess ? t('admin.dash_access_yes', 'Activé') : t('admin.dash_access_no', 'Aucun')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5 px-1">
        <Clock size={13} className="flex-shrink-0" />
        {t('admin.dash_since', { date: fmtDate(usageSince), defaultValue: "Suivi d'utilisation actif depuis le {{date}} — les comptes plus anciens apparaissent « jamais consulté » tant qu'ils n'ont pas rouvert l'application." })}
      </p>
    </div>
  );
}
