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

// Initial state for the specific medical plan requested
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
    dayOfWeek: 3, // Wednesday (18/03/2026 is a Wed)
    startDate: '2026-03-18',
    endDate: '2026-12-31',
  }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('today'); // 'today', 'history', 'settings'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medPlan, setMedPlan] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);

  // --- Auth & Initial Load ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user) return;

    const planRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'plan');
    const logsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');

    // Sync Plan
    const unsubPlan = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        setMedPlan(docSnap.data().items || []);
      } else {
        // Initialize with prompt data if first time
        setDoc(planRef, { items: INITIAL_PLAN });
        setMedPlan(INITIAL_PLAN);
      }
    }, (err) => console.error("Plan sync error:", err));

    // Sync Logs
    const unsubLogs = onSnapshot(logsCol, (snapshot) => {
      const newLogs = {};
      snapshot.forEach(doc => {
        newLogs[doc.id] = doc.data();
      });
      setLogs(newLogs);
      setLoading(false);
    }, (err) => console.error("Logs sync error:", err));

    return () => {
      unsubPlan();
      unsubLogs();
    };
  }, [user]);

  // --- Actions ---
  const toggleCheck = async (medId, dateStr) => {
    if (!user) return;
    const logId = dateStr;
    const currentLog = logs[logId] || { completed: [] };
    const isDone = currentLog.completed?.includes(medId);
    
    let newList;
    if (isDone) {
      newList = currentLog.completed.filter(id => id !== medId);
    } else {
      newList = [...(currentLog.completed || []), medId];
    }

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

  // --- Computed Data ---
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

  // --- UI Components ---
  const NavItem = ({ id, label, Icon }) => (
    <button 
      onClick={() => setView(id)}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${view === id ? 'text-blue-600' : 'text-gray-400'}`}
    >
      <Icon size={24} strokeWidth={view === id ? 2.5 : 2} />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium">Carregando seu plano...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans max-w-md mx-auto shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="bg-white px-6 pt-8 pb-4 border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Minha Saúde</h1>
          <div className="bg-blue-50 p-2 rounded-full text-blue-600">
            <Pill size={20} />
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-500">
          <CalendarIcon size={16} />
          <span className="text-sm font-medium">
            {getDayName(selectedDate)}, {selectedDate.getDate()} de {getMonthName(selectedDate)}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {view === 'today' && (
          <div className="space-y-6">
            {/* Date Selector */}
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <button 
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="font-semibold text-slate-700">
                {selectedDate.toLocaleDateString('pt-BR')}
              </span>
              <button 
                onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">Checklist Diário</h2>
              {activeMedsForDate.length > 0 ? (
                activeMedsForDate.map((med) => {
                  const isChecked = dateLogs.includes(med.id);
                  return (
                    <button
                      key={med.id}
                      onClick={() => toggleCheck(med.id, formatDate(selectedDate))}
                      className={`w-full flex items-center p-5 rounded-2xl transition-all border ${
                        isChecked 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                          : 'bg-white border-slate-100 text-slate-800 shadow-sm'
                      }`}
                    >
                      <div className={`mr-4 transition-transform duration-200 ${isChecked ? 'scale-110' : 'scale-100'}`}>
                        {isChecked ? (
                          <CheckCircle2 size={28} className="text-emerald-500 fill-emerald-50" />
                        ) : (
                          <Circle size={28} className="text-slate-200" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`font-bold text-lg ${isChecked ? 'line-through opacity-60' : ''}`}>
                          {med.name}
                        </div>
                        <div className="flex items-center text-xs mt-1 space-x-2 opacity-70">
                          <Clock size={12} />
                          <span>Período: <strong>{med.time}</strong></span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                  <AlertCircle size={40} strokeWidth={1.5} />
                  <p className="font-medium">Nenhum remédio para esta data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Protocolo de Tratamento</h2>
            <p className="text-sm text-slate-500 bg-blue-50 p-4 rounded-xl border border-blue-100 leading-relaxed">
              Aqui você pode editar ou adicionar novas fases do seu tratamento. Ideal para quando o médico alterar as dosagens após as primeiras 2 semanas.
            </p>

            <div className="space-y-3">
              {medPlan.map((med) => (
                <div key={med.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-800">{med.name}</h3>
                    <p className="text-xs text-slate-500">{med.time} • {med.type === 'diario' ? 'Diário' : 'Semanal'}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(med.startDate).toLocaleDateString()} até {med.endDate ? new Date(med.endDate).toLocaleDateString() : 'sempre'}
                    </p>
                  </div>
                  <button 
                    onClick={() => removeMed(med.id)}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                const name = prompt("Nome do remédio:");
                if(!name) return;
                const time = prompt("Período (Manhã/Tarde/Noite):", "Manhã");
                const startDate = prompt("Data de Início (AAAA-MM-DD):", formatDate(new Date()));
                if(name && time && startDate) {
                  addMed({
                    name,
                    time,
                    type: 'diario',
                    startDate,
                    endDate: ''
                  });
                }
              }}
              className="w-full flex items-center justify-center space-x-2 bg-slate-800 text-white p-4 rounded-2xl font-bold hover:bg-slate-900 active:scale-95 transition-all"
            >
              <Plus size={20} />
              <span>Adicionar Medicamento</span>
            </button>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-slate-800">Progresso Recente</h2>
             <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50">
               {Object.entries(logs)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, 7)
                .map(([date, data]) => (
                  <div key={date} className="p-4 flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-slate-700">{date.split('-').reverse().join('/')}</span>
                    </div>
                    <div className="flex space-x-1">
                      {data.completed.map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      ))}
                      {data.completed.length === 0 && <span className="text-xs text-slate-400">Pulo</span>}
                    </div>
                  </div>
               ))}
               {Object.keys(logs).length === 0 && (
                 <div className="p-8 text-center text-slate-400 text-sm italic">Nenhum registro ainda.</div>
               )}
             </div>
          </div>
        )}
      </main>

      {/* Tab Bar (iPhone style) */}
      <nav className="bg-white/80 backdrop-blur-lg border-t border-slate-100 h-20 px-4 pb-4 fixed bottom-0 w-full max-w-md flex items-center justify-around z-10">
        <NavItem id="today" label="Hoje" Icon={CheckCircle2} />
        <NavItem id="history" label="Histórico" Icon={History} />
        <NavItem id="settings" label="Plano" Icon={Settings} />
      </nav>

      {/* Bottom Padding for Safe Area */}
      <div className="h-6 bg-white w-full fixed bottom-0"></div>
    </div>
  );
}