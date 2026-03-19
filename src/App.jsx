import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Settings, 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  Pill,
  History,
  AlertCircle,
  Save,
  Trash2
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyC-d8Ot0ixhfJCR_pt_C7Lq56U9ZVqA8R0",
  authDomain: "checklist-pomada.firebaseapp.com",
  projectId: "checklist-pomada",
  storageBucket: "checklist-pomada.firebasestorage.app",
  messagingSenderId: "931236405830",
  appId: "1:931236405830:web:d7e8b9e2ecb1eb99cfe047",
  measurementId: "G-1NKYMSZZP9"
};

// --- INICIALIZAÇÃO DOS SERVIÇOS (Essencial para não dar erro) ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'checklist-pomada'; 

// --- Helper Functions ---
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getDayName = (date) => {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[date.getDay()];
};

const getMonthName = (date) => {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return months[date.getMonth()];
};

// Plano inicial solicitado
const INITIAL_PLAN = [
  {
    id: 'topison-morning',
    name: 'Topison (Pomada)',
    time: 'Manhã',
    type: 'diario',
    startDate: '2026-03-18',
    endDate: '2026-04-01',
  },
  {
    id: 'topison-night',
    name: 'Topison (Pomada)',
    time: 'Noite',
    type: 'diario',
    startDate: '2026-03-18',
    endDate: '2026-04-01',
  },
  {
    id: 'tarfic-night',
    name: 'Tarfic (Pomada)',
    time: 'Noite',
    type: 'diario',
    startDate: '2026-03-18',
    endDate: '2026-04-01',
  },
  {
    id: 'vitamina-d',
    name: 'Vitamina D',
    time: 'Manhã',
    type: 'semanal',
    dayOfWeek: 3, 
    startDate: '2026-03-18',
    endDate: '2026-12-31',
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('today'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medPlan, setMedPlan] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const planRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'plan');
    const logsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');

    const unsubPlan = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        setMedPlan(docSnap.data().items || []);
      } else {
        setDoc(planRef, { items: INITIAL_PLAN });
        setMedPlan(INITIAL_PLAN);
      }
    });

    const unsubLogs = onSnapshot(logsCol, (snapshot) => {
      const newLogs = {};
      snapshot.forEach(doc => { newLogs[doc.id] = doc.data(); });
      setLogs(newLogs);
      setLoading(false);
    });

    return () => { unsubPlan(); unsubLogs(); };
  }, [user]);

  const toggleCheck = async (medId, dateStr) => {
    if (!user) return;
    const logId = dateStr;
    const currentLog = logs[logId] || { completed: [] };
    const isDone = currentLog.completed?.includes(medId);
    let newList = isDone ? currentLog.completed.filter(id => id !== medId) : [...(currentLog.completed || []), medId];
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', logId), {
      completed: newList,
      updatedAt: new Date().toISOString()
    });
  };

  const addMed = async (newMed) => {
    if (!user) return;
    const updatedPlan = [...medPlan, { ...newMed, id: crypto.randomUUID() }];
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'plan'), { items: updatedPlan });
  };

  const removeMed = async (id) => {
    if (!user) return;
    const updatedPlan = medPlan.filter(m => m.id !== id);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'plan'), { items: updatedPlan });
  };

  const activeMedsForDate = useMemo(() => {
    const dateStr = formatDate(selectedDate);
    const dayOfWeek = selectedDate.getDay();
    return medPlan.filter(med => {
      const isAfterStart = dateStr >= med.startDate;
      const isBeforeEnd = med.endDate ? dateStr <= med.endDate : true;
      if (!isAfterStart || !isBeforeEnd) return false;
      if (med.type === 'diario') return true;
      if (med.type === 'semanal') return dayOfWeek === med.dayOfWeek;
      return false;
    }).sort((a, b) => {
      const order = { 'Manhã': 1, 'Tarde': 2, 'Noite': 3 };
      return (order[a.time] || 9) - (order[b.time] || 9);
    });
  }, [medPlan, selectedDate]);

  const dateLogs = logs[formatDate(selectedDate)]?.completed || [];

  const NavItem = ({ id, label, Icon }) => (
    <button onClick={() => setView(id)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === id ? 'text-blue-600' : 'text-gray-400'}`}>
      <Icon size={24} strokeWidth={view === id ? 2.5 : 2} />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans max-w-md mx-auto shadow-2xl overflow-hidden pb-24">
      <header className="bg-white px-6 pt-8 pb-4 border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Minha Saúde</h1>
          <div className="bg-blue-50 p-2 rounded-full text-blue-600"><Pill size={20} /></div>
        </div>
        <div className="flex items-center space-x-2 text-slate-500">
          <CalendarIcon size={16} />
          <span className="text-sm font-medium">{getDayName(selectedDate)}, {selectedDate.getDate()} de {getMonthName(selectedDate)}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {view === 'today' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))} className="p-2 text-slate-400"><ChevronLeft size={20} /></button>
              <span className="font-semibold text-slate-700">{selectedDate.toLocaleDateString('pt-BR')}</span>
              <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))} className="p-2 text-slate-400"><ChevronRight size={20} /></button>
            </div>
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Checklist Diário</h2>
              {activeMedsForDate.map((med) => {
                const isChecked = dateLogs.includes(med.id);
                return (
                  <button key={med.id} onClick={() => toggleCheck(med.id, formatDate(selectedDate))} className={`w-full flex items-center p-5 rounded-2xl border ${isChecked ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-white border-slate-100 text-slate-800 shadow-sm'}`}>
                    <div className="mr-4">{isChecked ? <CheckCircle2 size={28} className="text-emerald-500" /> : <Circle size={28} className="text-slate-200" />}</div>
                    <div className="flex-1 text-left">
                      <div className={`font-bold text-lg ${isChecked ? 'line-through opacity-60' : ''}`}>{med.name}</div>
                      <div className="flex items-center text-xs mt-1 space-x-2 opacity-70"><Clock size={12} /><span>{med.time}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {view === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Plano</h2>
            <div className="space-y-3">
              {medPlan.map((med) => (
                <div key={med.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div><h3 className="font-bold">{med.name}</h3><p className="text-xs text-slate-500">{med.time}</p></div>
                  <button onClick={() => removeMed(med.id)} className="p-2 text-red-400"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const name = prompt("Nome:"); if(!name) return;
              addMed({ name, time: "Manhã", type: 'diario', startDate: formatDate(new Date()), endDate: '' });
            }} className="w-full bg-slate-800 text-white p-4 rounded-2xl font-bold">Adicionar</button>
          </div>
        )}
        {view === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Histórico</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y">
              {Object.entries(logs).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 7).map(([date, data]) => (
                <div key={date} className="p-4 flex justify-between">
                  <span className="text-sm font-bold">{date.split('-').reverse().join('/')}</span>
                  <div className="flex space-x-1">{data.completed.map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-emerald-400"></div>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="bg-white/80 backdrop-blur-lg border-t border-slate-100 h-20 px-4 pb-4 fixed bottom-0 w-full max-w-md flex items-center justify-around z-10">
        <NavItem id="today" label="Hoje" Icon={CheckCircle2} />
        <NavItem id="history" label="Histórico" Icon={History} />
        <NavItem id="settings" label="Plano" Icon={Settings} />
      </nav>
    </div>
  );
}