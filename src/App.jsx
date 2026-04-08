import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot 
} from 'firebase/firestore';
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
  Trash2,
  X
} from 'lucide-react';

// --- CONFIGURAÇÃO DO SEU FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC-d8Ot0ixhfJCR_pt_C7Lq56U9ZVqA8R0",
  authDomain: "checklist-pomada.firebaseapp.com",
  projectId: "checklist-pomada",
  storageBucket: "checklist-pomada.firebasestorage.app",
  messagingSenderId: "931236405830",
  appId: "1:931236405830:web:d7e8b9e2ecb1eb99cfe047",
  measurementId: "G-1NKYMSZZP9"
};

// Inicialização dos serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'checklist-saude-dinamico'; 

// Funções Auxiliares
const formatDate = (date) => date.toISOString().split('T')[0];
const getDayName = (date) => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
const getMonthName = (date) => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][date.getMonth()];

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('today'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [medPlan, setMedPlan] = useState([]);
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Estado para o formulário de novo medicamento
  const [newMed, setNewMed] = useState({
    name: '',
    time: 'Manhã',
    type: 'diario', 
    selectedDays: [1, 2, 3, 4, 5], 
    startDate: formatDate(new Date()),
    durationWeeks: 2
  });

  // 1. Autenticação Anónima
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Erro Auth:", err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Sincronização com Firestore
  useEffect(() => {
    if (!user) return;
    const userId = user.uid.replace(/\//g, '_');
    
    const planRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'plan');
    const logsCol = collection(db, 'artifacts', appId, 'users', userId, 'logs');

    const unsubPlan = onSnapshot(planRef, (docSnap) => {
      setMedPlan(docSnap.exists() ? (docSnap.data().items || []) : []);
      setLoading(false);
    });

    const unsubLogs = onSnapshot(logsCol, (snapshot) => {
      const newLogs = {};
      snapshot.forEach(d => newLogs[d.id] = d.data());
      setLogs(newLogs);
    });

    return () => { unsubPlan(); unsubLogs(); };
  }, [user]);

  // Função para marcar/desmarcar
  const toggleCheck = async (medId, dateStr) => {
    if (!user) return;
    const userId = user.uid.replace(/\//g, '_');
    const currentLog = logs[dateStr] || { completed: [] };
    const isDone = (currentLog.completed || []).includes(medId);
    const newList = isDone 
      ? currentLog.completed.filter(id => id !== medId) 
      : [...(currentLog.completed || []), medId];
    
    await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'logs', dateStr), { 
      completed: newList,
      updatedAt: new Date().toISOString()
    });
  };

  // Função para adicionar medicamento
  const handleAddMed = async () => {
    if (!newMed.name || !user) return;
    const userId = user.uid.replace(/\//g, '_');
    const start = new Date(newMed.startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + (newMed.durationWeeks * 7));

    const updatedPlan = [...medPlan, {
      ...newMed,
      id: crypto.randomUUID(),
      endDate: formatDate(end)
    }];
    
    await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'plan'), { items: updatedPlan });
    setShowAddModal(false);
    setNewMed({ name: '', time: 'Manhã', type: 'diario', selectedDays: [1,2,3,4,5], startDate: formatDate(new Date()), durationWeeks: 2 });
  };

  // Função para remover do plano
  const removeMed = async (id) => {
    if (!user) return;
    const userId = user.uid.replace(/\//g, '_');
    const updatedPlan = medPlan.filter(m => m.id !== id);
    await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'plan'), { items: updatedPlan });
  };

  // Filtro de medicamentos ativos para a data selecionada
  const activeMedsForDate = useMemo(() => {
    const dateStr = formatDate(selectedDate);
    const dayOfWeek = selectedDate.getDay();
    return medPlan.filter(med => {
      const isWithinDate = dateStr >= med.startDate && (med.endDate ? dateStr <= med.endDate : true);
      if (!isWithinDate) return false;
      return med.type === 'diario' ? true : (med.selectedDays || []).includes(dayOfWeek);
    }).sort((a, b) => {
      const order = { 'Manhã': 1, 'Tarde': 2, 'Noite': 3 };
      return (order[a.time] || 9) - (order[b.time] || 9);
    });
  }, [medPlan, selectedDate]);

  if (loading || !user) return (
    <div className="flex flex-col h-screen items-center justify-center bg-slate-50 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest italic">A carregar...</p>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden relative pb-24 font-sans">
      {/* Cabeçalho */}
      <header className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none">Saúde</h1>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2">{getMonthName(selectedDate)}</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 shadow-sm transition-transform active:scale-95">
          <Pill size={28} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        {view === 'today' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Seletor de Data */}
            <div className="flex items-center justify-between bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100">
              <button onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 86400000))} className="p-3 text-slate-300 hover:text-blue-500 active:scale-90 transition-all">
                <ChevronLeft size={24} />
              </button>
              <div className="text-center">
                <div className="font-black text-slate-800 text-lg">{selectedDate.toLocaleDateString('pt-BR')}</div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-black">{getDayName(selectedDate)}</div>
              </div>
              <button onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 86400000))} className="p-3 text-slate-300 hover:text-blue-500 active:scale-90 transition-all">
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-4">
              {activeMedsForDate.length > 0 ? activeMedsForDate.map(med => {
                const dateKey = formatDate(selectedDate);
                const isChecked = (logs[dateKey]?.completed || []).includes(med.id);
                return (
                  <button 
                    key={med.id} 
                    onClick={() => toggleCheck(med.id, dateKey)} 
                    className={`w-full flex items-center p-6 rounded-[2.5rem] border transition-all active:scale-[0.97] ${
                      isChecked ? 'bg-emerald-50 border-emerald-100 shadow-inner' : 'bg-white border-slate-100 shadow-sm'
                    }`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="text-emerald-500 mr-5 flex-shrink-0" size={36} />
                    ) : (
                      <Circle className="text-slate-100 mr-5 flex-shrink-0" size={36} />
                    )}
                    <div className="text-left overflow-hidden">
                      <div className={`font-black text-xl truncate ${isChecked ? 'line-through text-slate-300' : 'text-slate-800'}`}>
                        {med.name}
                      </div>
                      <div className="flex items-center text-[10px] text-slate-400 mt-1.5 font-black uppercase tracking-widest">
                        <Clock size={12} className="mr-1.5" /> {med.time}
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-200 space-y-4">
                  <CalendarIcon size={64} strokeWidth={1} />
                  <p className="font-black text-[10px] uppercase tracking-[0.3em]">Nada agendado</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight px-1">O Meu Plano</h2>
            <div className="space-y-3">
              {medPlan.map(med => (
                <div key={med.id} className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm flex justify-between items-center group">
                  <div className="overflow-hidden mr-4">
                    <div className="font-black text-slate-800 text-lg truncate">{med.name}</div>
                    <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">
                      {med.time} • {med.type === 'diario' ? 'Diário' : 'Personalizado'}
                    </div>
                    <div className="text-[10px] text-blue-500 mt-2 font-black uppercase tracking-tighter">
                      Até {new Date(med.endDate).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button 
                    onClick={() => removeMed(med.id)} 
                    className="text-rose-400 p-4 bg-rose-50 rounded-2xl transition-all active:scale-90"
                  >
                    <Trash2 size={22} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="w-full bg-slate-900 text-white p-7 rounded-[2.5rem] font-black flex justify-center items-center gap-3 shadow-2xl active:scale-95 transition-all tracking-[0.2em] uppercase text-xs"
            >
              <Plus size={24} /> Adicionar Medicamento
            </button>
          </div>
        )}

        {view === 'history' && (
           <div className="space-y-4 animate-in slide-in-from-left duration-300">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight px-1">Histórico</h2>
              <div className="bg-white rounded-[2.8rem] border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
                {Object.entries(logs).sort().reverse().slice(0, 15).map(([date, data]) => (
                  <div key={date} className="p-7 flex justify-between items-center">
                    <span className="text-sm font-black text-slate-700">{date.split('-').reverse().join('/')}</span>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full border border-emerald-100 uppercase tracking-widest">
                      {Number(data.completed?.length || 0)} Feitos
                    </span>
                  </div>
                ))}
              </div>
           </div>
        )}
      </main>

      {/* Modal Adicionar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] sm:rounded-[3.5rem] p-10 space-y-8 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Novo Plano</h3>
              <button onClick={() => setShowAddModal(false)} className="p-3 bg-slate-100 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Medicamento</label>
                <input 
                  type="text" placeholder="Nome" 
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.8rem] outline-none focus:border-blue-500 focus:bg-white transition-all font-black text-lg"
                  value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})}
                />
              </div>

              <div className="flex gap-2">
                {['Manhã', 'Tarde', 'Noite'].map(t => (
                  <button key={t} onClick={() => setNewMed({...newMed, time: t})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black transition-all ${newMed.time === t ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-slate-100 text-slate-400'}`}>{t.toUpperCase()}</button>
                ))}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Repetição</label>
                <div className="flex gap-2">
                  <button onClick={() => setNewMed({...newMed, type: 'diario'})} className={`flex-1 p-4 rounded-2xl text-[10px] font-black transition-all ${newMed.type === 'diario' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>DIÁRIO</button>
                  <button onClick={() => setNewMed({...newMed, type: 'semanal'})} className={`flex-1 p-4 rounded-2xl text-[10px] font-black transition-all ${newMed.type === 'semanal' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>ESPECÍFICO</button>
                </div>
              </div>

              {newMed.type === 'semanal' && (
                <div className="flex justify-between bg-slate-50 p-4 rounded-3xl border border-slate-200">
                  {['D','S','T','Q','Q','S','S'].map((d, i) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        const days = newMed.selectedDays.includes(i) ? newMed.selectedDays.filter(day => day !== i) : [...newMed.selectedDays, i];
                        setNewMed({...newMed, selectedDays: days});
                      }}
                      className={`w-10 h-10 rounded-full text-[10px] font-black transition-all ${
                        newMed.selectedDays.includes(i) ? 'bg-blue-500 text-white shadow-md scale-110' : 'text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Início</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[1.8rem] text-xs font-black" value={newMed.startDate} onChange={e => setNewMed({...newMed, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Semanas</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[1.8rem] text-xs font-black text-center" value={newMed.durationWeeks} onChange={e => setNewMed({...newMed, durationWeeks: parseInt(e.target.value) || 1})} />
                </div>
              </div>
            </div>

            <button onClick={handleAddMed} className="w-full bg-emerald-500 text-white py-6 rounded-[2.8rem] font-black shadow-xl shadow-emerald-50 active:scale-95 transition-all mt-6 tracking-[0.2em] uppercase text-sm">
              Confirmar Plano
            </button>
          </div>
        </div>
      )}

      {/* Nav bar */}
      <nav className="bg-white/90 backdrop-blur-2xl border-t border-slate-100 h-24 px-10 pb-10 fixed bottom-0 w-full max-w-md flex items-center justify-around z-10">
        <button onClick={() => setView('today')} className={`flex flex-col items-center gap-2 transition-all ${view === 'today' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <CheckCircle2 size={30} strokeWidth={view === 'today' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Hoje</span>
        </button>
        <button onClick={() => setView('history')} className={`flex flex-col items-center gap-2 transition-all ${view === 'history' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <History size={30} strokeWidth={view === 'history' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Registos</span>
        </button>
        <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-2 transition-all ${view === 'settings' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <Settings size={30} strokeWidth={view === 'settings' ? 3 : 2} />
          <span className="text-[9px] font-black uppercase tracking-widest">Plano</span>
        </button>
      </nav>
    </div>
  );
}