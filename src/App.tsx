import { useState, useCallback, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import TimeEntryPage from './pages/TimeEntry';
import Payroll from './pages/Payroll';
import Employees from './pages/Employees';
import Import from './pages/Import';
import SalaryCalc from './pages/SalaryCalc';
import { getEmployees, getEntries } from './lib/storage';
import { t, type Lang } from './lib/i18n';

function loadData() {
  return { employees: getEmployees(), entries: getEntries() };
}

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState(loadData);
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const refresh = useCallback(() => setData(loadData()), []);
  const s = t[lang];

  return (
    <Layout activeTab={tab} onTabChange={setTab} lang={lang} onLangChange={setLang} theme={theme} onThemeChange={setTheme} s={s}>
      {tab === 'dashboard' && <Dashboard employees={data.employees} entries={data.entries} onRefresh={refresh} s={s} />}
      {tab === 'time' && <TimeEntryPage employees={data.employees} entries={data.entries} onRefresh={refresh} s={s} />}
      {tab === 'payroll' && <Payroll employees={data.employees} entries={data.entries} s={s} />}
      {tab === 'employees' && <Employees employees={data.employees} onRefresh={refresh} s={s} />}
      {tab === 'import' && <Import employees={data.employees} onRefresh={refresh} s={s} />}
      {tab === 'calc' && <SalaryCalc s={s} />}
    </Layout>
  );
}
