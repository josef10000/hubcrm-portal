import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, updateDoc, query, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import { 
  DollarSign, Calendar, TrendingUp, AlertCircle, CheckCircle, RefreshCw, Phone, Filter, Plus, Trash2, Edit3, TrendingDown, X, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';

interface PortalCRMFinanceProps {
  orgId: string;
  clientId: string;
}

interface Expense {
  id: string;
  clientId: string;
  description: string;
  value: number;
  category: string;
  date: string;
  type: 'pontual' | 'fixo'; // Pontual ou Fixo Mensal
  status: 'paid' | 'unpaid';
  createdAt: any;
  appointmentId?: string;
  appointmentClientName?: string;
}

interface Revenue {
  id: string;
  clientId: string;
  description: string;
  value: number;
  category: string;
  date: string;
  type: 'pontual' | 'fixo'; // Pontual ou Fixo Mensal
  status: 'paid' | 'unpaid';
  createdAt: any;
}

export default function PortalCRMFinance({ orgId, clientId }: PortalCRMFinanceProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // Controle de abas e filtros
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'all'>('month');
  const [subTab, setSubTab] = useState<'revenues' | 'expenses' | 'projects'>('revenues');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Modal de despesas
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
  // Estados do formulário de despesa
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Aluguel');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().substring(0, 10));
  const [expenseType, setExpenseType] = useState<'pontual' | 'fixo'>('pontual');
  const [expenseStatus, setExpenseStatus] = useState<'paid' | 'unpaid'>('paid');
  const [expenseAppointmentId, setExpenseAppointmentId] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);

  // Modal de receitas manuais
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
  
  // Estados do formulário de receita manual
  const [revenueDesc, setRevenueDesc] = useState('');
  const [revenueValue, setRevenueValue] = useState('');
  const [revenueCategory, setRevenueCategory] = useState('Mensalidade');
  const [revenueDate, setRevenueDate] = useState(new Date().toISOString().substring(0, 10));
  const [revenueType, setRevenueType] = useState<'pontual' | 'fixo'>('pontual');
  const [revenueStatus, setRevenueStatus] = useState<'paid' | 'unpaid'>('paid');
  const [savingRevenue, setSavingRevenue] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Estado para Confirmação Customizada
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'expense' | 'revenue' | '';
    itemId: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: '',
    itemId: '',
    title: '',
    message: ''
  });

  const executeConfirmAction = async () => {
    const { type, itemId } = confirmModal;
    if (!itemId || !orgId) return;

    try {
      if (type === 'expense') {
        await deleteDoc(doc(db, 'organizations', orgId, 'expenses', itemId));
        toast.success('Gasto removido com sucesso.');
      } else if (type === 'revenue') {
        await deleteDoc(doc(db, 'organizations', orgId, 'revenues', itemId));
        toast.success('Receita removida com sucesso.');
      }
      setConfirmModal({ isOpen: false, type: '', itemId: '', title: '', message: '' });
    } catch (e) {
      console.error(e);
      toast.error(`Erro ao excluir ${type === 'expense' ? 'gasto' : 'receita'}.`);
    }
  };

  // Escuta agendamentos em tempo real
  useEffect(() => {
    if (!orgId) return;
    const appointmentsRef = collection(db, 'organizations', orgId, 'appointments');
    const q = query(appointmentsRef, orderBy('date', 'desc'), orderBy('time', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((app: any) => app.clientId === clientId);
      setAppointments(list);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // Escuta despesas em tempo real
  useEffect(() => {
    if (!orgId || !clientId) return;
    const expensesRef = collection(db, 'organizations', orgId, 'expenses');
    const q = query(expensesRef, orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data, 
            type: data.type || 'pontual' // Fallback para registros antigos
          } as Expense;
        })
        .filter(exp => exp.clientId === clientId);
      setExpenses(list);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // Escuta receitas manuais em tempo real
  useEffect(() => {
    if (!orgId || !clientId) return;
    const revenuesRef = collection(db, 'organizations', orgId, 'revenues');
    const q = query(revenuesRef, orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            ...data, 
            type: data.type || 'pontual'
          } as Revenue;
        })
        .filter(rev => rev.clientId === clientId);
      setRevenues(list);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // Escuta Serviços do Cliente (para obter custo de insumos)
  useEffect(() => {
    if (!orgId) return;
    const servicesRef = collection(db, 'organizations', orgId, 'client_services');
    const unsub = onSnapshot(servicesRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setServices(list);
    });
    return () => unsub();
  }, [orgId]);

  // Escuta Inventário (para obter custos unitários)
  useEffect(() => {
    if (!orgId) return;
    const inventoryRef = collection(db, 'organizations', orgId, 'inventory');
    const unsub = onSnapshot(inventoryRef, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInventory(list);
    });
    return () => unsub();
  }, [orgId]);

  // Obtém as datas limites (Início e Fim) do período selecionado
  const getPeriodBounds = (): { start: Date; end: Date } => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localToday = new Date(today.getTime() - tzOffset);

    let start = new Date(localToday);
    let end = new Date(localToday);

    switch (filterPeriod) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Domingo da semana atual
        const dayOfWeek = localToday.getDay();
        start.setDate(localToday.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);

        // Sábado da semana atual
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last_month':
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        start = new Date('2000-01-01T00:00:00');
        end = new Date('2099-12-31T23:59:59');
        break;
    }

    return { start, end };
  };

  const { start: periodStart, end: periodEnd } = getPeriodBounds();

  // Verifica se uma data específica cai no período ativo
  const isDateInPeriod = (dateStr: string) => {
    if (!dateStr) return false;
    const itemDate = new Date(dateStr + 'T12:00:00');
    return itemDate >= periodStart && itemDate <= periodEnd;
  };

  // Algoritmo matemático para contar ocorrências de um item fixo mensal recorrente (gasto ou receita)
  const countFixedOccurrences = (dateStr: string, start: Date, end: Date): number => {
    const itemStartDate = new Date(dateStr + 'T00:00:00');
    if (itemStartDate > end) return 0;

    let occurrences = 0;
    
    // Inicia o loop no mês mais tardio entre o início do período e o início do item
    const loopStart = new Date(Math.max(start.getTime(), itemStartDate.getTime()));
    let currentYear = loopStart.getFullYear();
    let currentMonth = loopStart.getMonth();

    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    const originalDate = new Date(dateStr + 'T12:00:00');
    const dueDay = originalDate.getDate();

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      const occurrenceDate = new Date(currentYear, currentMonth, dueDay, 12, 0, 0);
      
      // Validação para dias inexistentes no mês analisado (ex: dia 31 em fevereiro)
      if (occurrenceDate.getMonth() !== currentMonth) {
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0, 12, 0, 0);
        if (lastDayOfMonth >= start && lastDayOfMonth <= end && lastDayOfMonth >= itemStartDate) {
          occurrences++;
        }
      } else {
        if (occurrenceDate >= start && occurrenceDate <= end && occurrenceDate >= itemStartDate) {
          occurrences++;
        }
      }

      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    return occurrences;
  };

  // Filtragem dos dados consolidados de receitas (Agendamentos)
  const appointmentsFiltered = appointments.filter(app => isDateInPeriod(app.date) && app.status !== 'cancelled');

  // Cálculos de Receitas Manuais no período
  const totalManualProjetado = revenues.reduce((acc, rev) => {
    if (rev.type === 'fixo') {
      const occurrences = countFixedOccurrences(rev.date, periodStart, periodEnd);
      return acc + (rev.value * occurrences);
    } else {
      if (isDateInPeriod(rev.date)) {
        return acc + (rev.value || 0);
      }
      return acc;
    }
  }, 0);

  const totalManualPago = revenues.reduce((acc, rev) => {
    if (rev.status === 'paid') {
      if (rev.type === 'fixo') {
        const occurrences = countFixedOccurrences(rev.date, periodStart, periodEnd);
        return acc + (rev.value * occurrences);
      } else {
        if (isDateInPeriod(rev.date)) {
          return acc + (rev.value || 0);
        }
      }
    }
    return acc;
  }, 0);

  const totalManualPendente = revenues.reduce((acc, rev) => {
    if (rev.status !== 'paid') {
      if (rev.type === 'fixo') {
        const occurrences = countFixedOccurrences(rev.date, periodStart, periodEnd);
        return acc + (rev.value * occurrences);
      } else {
        if (isDateInPeriod(rev.date)) {
          return acc + (rev.value || 0);
        }
      }
    }
    return acc;
  }, 0);

  // Cálculos contábeis totais (Receitas = Agendamentos + Receitas Manuais)
  const totalAppointmentsProjetado = appointmentsFiltered.reduce((acc, app) => acc + (app.price || 0), 0);
  const totalAppointmentsPago = appointmentsFiltered
    .filter(app => app.paymentStatus === 'paid')
    .reduce((acc, app) => acc + (app.price || 0), 0);
  const totalAppointmentsPendente = appointmentsFiltered
    .filter(app => app.paymentStatus !== 'paid')
    .reduce((acc, app) => acc + (app.price || 0), 0);

  const totalProjetado = totalAppointmentsProjetado + totalManualProjetado;
  const totalPago = totalAppointmentsPago + totalManualPago;
  const totalPendente = totalAppointmentsPendente + totalManualPendente;

  const totalCount = appointmentsFiltered.length + revenues.filter(rev => {
    if (rev.type === 'fixo') {
      return countFixedOccurrences(rev.date, periodStart, periodEnd) > 0;
    }
    return isDateInPeriod(rev.date);
  }).length;
  const ticketMedio = totalCount > 0 ? totalProjetado / totalCount : 0;

  // Cálculos contábeis (Despesas - Somando Pontuais e Recorrências de Fixas)
  const totalExpenses = expenses.reduce((acc, exp) => {
    if (exp.type === 'fixo') {
      const occurrences = countFixedOccurrences(exp.date, periodStart, periodEnd);
      return acc + (exp.value * occurrences);
    } else {
      if (isDateInPeriod(exp.date)) {
        return acc + (exp.value || 0);
      }
      return acc;
    }
  }, 0);

  // Lucro Líquido = Receitas Recebidas (Efetivadas) - Despesas Totais projetadas no período
  const lucroLiquido = totalPago - totalExpenses;

  // Alteração de status de pagamento do agendamento
  const handleTogglePaymentStatus = async (appId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'appointments', appId), {
        paymentStatus: nextStatus
      });
      toast.success(`Pagamento marcado como ${nextStatus === 'paid' ? 'Pago' : 'Pendente'}`);
    } catch (e) {
      toast.error('Erro ao atualizar status de pagamento.');
    }
  };

  // Alteração de status do gasto/despesa
  const handleToggleExpenseStatus = async (expId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'expenses', expId), {
        status: nextStatus
      });
      toast.success(`Gasto marcado como ${nextStatus === 'paid' ? 'Pago' : 'Pendente'}`);
    } catch (e) {
      toast.error('Erro ao atualizar status do gasto.');
    }
  };

  // Deleção de despesa
  const handleDeleteExpense = (expId: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'expense',
      itemId: expId,
      title: 'Excluir Gasto',
      message: 'Deseja realmente excluir este registro de gasto? Essa ação não poderá ser desfeita.'
    });
  };

  // Abertura do modal para novo gasto
  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setExpenseDesc('');
    setExpenseValue('');
    setExpenseCategory('Aluguel');
    setExpenseDate(new Date().toISOString().substring(0, 10));
    setExpenseType('pontual');
    setExpenseStatus('paid');
    setExpenseAppointmentId('');
    setIsExpenseModalOpen(true);
  };

  // Abertura do modal para edição de gasto existente
  const openEditExpenseModal = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setExpenseDesc(exp.description);
    setExpenseValue(exp.value.toString().replace('.', ','));
    setExpenseCategory(exp.category);
    setExpenseDate(exp.date);
    setExpenseType(exp.type || 'pontual');
    setExpenseStatus(exp.status);
    setExpenseAppointmentId(exp.appointmentId || '');
    setIsExpenseModalOpen(true);
  };

  // Salvamento (Criação ou Edição) de despesa
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseValue || !expenseDate) {
      toast.error('Por favor, preencha todos os campos.');
      return;
    }

    setSavingExpense(true);
    try {
      let appointmentClientName = '';
      if (expenseAppointmentId) {
        const app = appointments.find(a => a.id === expenseAppointmentId);
        if (app) {
          appointmentClientName = app.clientName;
        }
      }

      const payload = {
        description: expenseDesc.trim(),
        value: parseFloat(expenseValue.replace(',', '.')),
        category: expenseCategory,
        date: expenseDate,
        type: expenseType,
        status: expenseStatus,
        appointmentId: expenseAppointmentId || null,
        appointmentClientName: appointmentClientName || null,
        updatedAt: new Date()
      };

      if (editingExpenseId) {
        await updateDoc(doc(db, 'organizations', orgId, 'expenses', editingExpenseId), payload);
        toast.success('Gasto atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'expenses'), {
          ...payload,
          clientId,
          createdAt: new Date()
        });
        toast.success('Gasto cadastrado com sucesso!');
      }

      setIsExpenseModalOpen(false);
    } catch (err) {
      toast.error('Erro ao salvar despesa.');
      console.error(err);
    } finally {
      setSavingExpense(false);
    }
  };

  // Abertura do modal para nova receita manual
  const openNewRevenueModal = () => {
    setEditingRevenueId(null);
    setRevenueDesc('');
    setRevenueValue('');
    setRevenueCategory('Mensalidade');
    setRevenueDate(new Date().toISOString().substring(0, 10));
    setRevenueType('pontual');
    setRevenueStatus('paid');
    setIsRevenueModalOpen(true);
  };

  // Abertura do modal para edição de receita manual existente
  const openEditRevenueModal = (rev: any) => {
    setEditingRevenueId(rev.id);
    setRevenueDesc(rev.description);
    setRevenueValue(rev.value.toString().replace('.', ','));
    setRevenueCategory(rev.category);
    setRevenueDate(rev.date);
    setRevenueType(rev.type || 'pontual');
    setRevenueStatus(rev.status);
    setIsRevenueModalOpen(true);
  };

  // Alteração de status da receita manual
  const handleToggleRevenueStatus = async (revId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await updateDoc(doc(db, 'organizations', orgId, 'revenues', revId), {
        status: nextStatus
      });
      toast.success(`Receita marcada como ${nextStatus === 'paid' ? 'Paga' : 'Pendente'}`);
    } catch (e) {
      toast.error('Erro ao atualizar status da receita.');
    }
  };

  // Deleção de receita manual
  const handleDeleteRevenue = (revId: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'revenue',
      itemId: revId,
      title: 'Excluir Receita',
      message: 'Deseja realmente excluir este registro de receita? Essa ação não poderá ser desfeita.'
    });
  };

  // Salvamento (Criação ou Edição) de receita manual
  const handleSaveRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revenueDesc.trim() || !revenueValue || !revenueDate) {
      toast.error('Por favor, preencha todos os campos.');
      return;
    }

    setSavingRevenue(true);
    try {
      const payload = {
        description: revenueDesc.trim(),
        value: parseFloat(revenueValue.replace(',', '.')),
        category: revenueCategory,
        date: revenueDate,
        type: revenueType,
        status: revenueStatus,
        updatedAt: new Date()
      };

      if (editingRevenueId) {
        await updateDoc(doc(db, 'organizations', orgId, 'revenues', editingRevenueId), payload);
        toast.success('Receita atualizada com sucesso!');
      } else {
        await addDoc(collection(db, 'organizations', orgId, 'revenues'), {
          ...payload,
          clientId,
          createdAt: new Date()
        });
        toast.success('Receita cadastrada com sucesso!');
      }

      setIsRevenueModalOpen(false);
    } catch (err) {
      toast.error('Erro ao salvar receita.');
      console.error(err);
    } finally {
      setSavingRevenue(false);
    }
  };

  // Filtragem da listagem de Receitas para a tabela
  const filteredAppointments = appointments.filter(app => {
    if (!isDateInPeriod(app.date) || app.status === 'cancelled') return false;
    if (filterPayment === 'paid') return app.paymentStatus === 'paid';
    if (filterPayment === 'unpaid') return app.paymentStatus !== 'paid';
    return true;
  });

  // Filtragem da listagem de Receitas Manuais para a tabela
  const filteredRevenues = revenues.filter(rev => {
    if (rev.type === 'fixo') {
      const revStartDate = new Date(rev.date + 'T00:00:00');
      if (revStartDate > periodEnd) return false;
    } else {
      if (!isDateInPeriod(rev.date)) return false;
    }
    
    if (filterPayment === 'paid') return rev.status === 'paid';
    if (filterPayment === 'unpaid') return rev.status !== 'paid';
    return true;
  });

  // Combinação das receitas de agendamento e receitas manuais, ordenadas por data desc
  const combinedRevenues = [
    ...filteredAppointments.map(app => ({
      id: app.id,
      date: app.date,
      time: app.time,
      clientName: app.clientName,
      description: app.serviceName || 'Agendamento',
      value: app.price || 0,
      status: app.paymentStatus || 'unpaid',
      type: 'pontual',
      isAppointment: true,
      category: 'Agendamento',
      clientPhone: app.clientPhone
    })),
    ...filteredRevenues.map(rev => ({
      id: rev.id,
      date: rev.date,
      time: '-',
      clientName: '-',
      description: rev.description,
      value: rev.value || 0,
      status: rev.status || 'unpaid',
      type: rev.type || 'pontual',
      isAppointment: false,
      category: rev.category,
      clientPhone: null
    }))
  ].sort((a, b) => {
    return new Date(b.date + 'T12:00:00').getTime() - new Date(a.date + 'T12:00:00').getTime();
  });

  // Filtragem da listagem de Despesas para a tabela
  // Para gastos fixos (recorrentes), eles aparecem se a data de início for anterior ou igual ao final do período.
  const filteredExpenses = expenses.filter(exp => {
    if (exp.type === 'fixo') {
      const expStartDate = new Date(exp.date + 'T00:00:00');
      if (expStartDate > periodEnd) return false;
    } else {
      if (!isDateInPeriod(exp.date)) return false;
    }
    
    if (filterPayment === 'paid') return exp.status === 'paid';
    if (filterPayment === 'unpaid') return exp.status !== 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Abas de Filtro de Período Temporal com botão de Fechamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'month', label: 'Este Mês' },
            { id: 'last_month', label: 'Mês Passado' },
            { id: 'all', label: 'Geral' }
          ].map(period => (
            <button
              key={period.id}
              onClick={() => setFilterPeriod(period.id as any)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                filterPeriod === period.id 
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIsPrintModalOpen(true)}
          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-xs flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-emerald-500/10 cursor-pointer shrink-0"
        >
          <ExternalLink size={14} />
          <span>Exportar Fechamento</span>
        </button>
      </div>

      {/* Cards de Métricas Reativas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Card 1: Faturamento Projetado */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-white group-hover:scale-110 transition-transform">
            <DollarSign size={80} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Faturamento Projetado</span>
            <span className="p-1 bg-primary-500/10 text-primary-400 rounded-lg"><Calendar size={14} /></span>
          </div>
          <p className="text-2xl font-black text-white">R$ {totalProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-gray-500 mt-1 italic">Total agendado no período</p>
        </div>

        {/* Card 2: Valor Efetivado (Recebido) */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500 group-hover:scale-110 transition-transform">
            <CheckCircle size={80} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receitas Recebidas</span>
            <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg"><CheckCircle size={14} /></span>
          </div>
          <p className="text-2xl font-black text-emerald-400">R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-emerald-500/85 mt-1 font-bold">Total de entradas pagas</p>
        </div>

        {/* Card 3: Despesas Totais */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-red-500 group-hover:scale-110 transition-transform">
            <TrendingDown size={80} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Despesas Registradas</span>
            <span className="p-1 bg-red-500/10 text-red-400 rounded-lg"><TrendingDown size={14} /></span>
          </div>
          <p className="text-2xl font-black text-red-400">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-red-400/85 mt-1 font-bold">Total de saídas + fixas projetadas</p>
        </div>

        {/* Card 4: Lucro Líquido */}
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform ${lucroLiquido >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            <TrendingUp size={80} />
          </div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lucro Líquido Real</span>
            <span className={`p-1 rounded-lg ${lucroLiquido >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              <TrendingUp size={14} />
            </span>
          </div>
          <p className={`text-2xl font-black ${lucroLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 italic">Entradas (pagas) menos despesas</p>
        </div>
      </div>

      {/* Seção Principal Contábil */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <DollarSign className="text-primary-400" size={20} />
              Controle Contábil
            </h2>
            <p className="text-xs text-gray-400">Gerencie a saúde financeira da sua microempresa registrando receitas e gastos.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto relative">
            {/* Dropdown Customizado para Mobile */}
            <div className="relative block sm:hidden w-full z-20">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-4 py-3 bg-[#0d0e12]/85 backdrop-blur-xl border border-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-wider outline-none transition-all cursor-pointer flex items-center justify-between text-left"
              >
                <span>
                  {subTab === 'revenues' ? 'Receitas' :
                   subTab === 'expenses' ? 'Despesas' : 'Lucro por Projeto'}
                </span>
                <ChevronDown 
                  size={14} 
                  className={`text-gray-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-primary-400' : ''}`} 
                />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-[#0a0c10]/95 border border-white/10 backdrop-blur-2xl rounded-xl p-1.5 shadow-2xl flex flex-col space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      type="button"
                      onClick={() => { setSubTab('revenues'); setFilterPayment('all'); setIsDropdownOpen(false); }}
                      className={`w-full px-4 py-3 rounded-lg text-left text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-0 ${
                        subTab === 'revenues' ? 'bg-primary-500/15 text-primary-400 font-black' : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                      }`}
                    >
                      Receitas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSubTab('expenses'); setFilterPayment('all'); setIsDropdownOpen(false); }}
                      className={`w-full px-4 py-3 rounded-lg text-left text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-0 ${
                        subTab === 'expenses' ? 'bg-primary-500/15 text-primary-400 font-black' : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                      }`}
                    >
                      Despesas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSubTab('projects'); setFilterPayment('all'); setIsDropdownOpen(false); }}
                      className={`w-full px-4 py-3 rounded-lg text-left text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border-0 ${
                        subTab === 'projects' ? 'bg-primary-500/15 text-primary-400 font-black' : 'text-gray-400 hover:bg-primary-500/10 hover:text-primary-400'
                      }`}
                    >
                      Lucro por Projeto
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Seletor de visualização Desktop (Receitas vs Despesas vs Projetos) */}
            <div className="hidden sm:flex p-1 bg-black/40 border border-white/10 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => { setSubTab('revenues'); setFilterPayment('all'); }}
                className={`flex-1 sm:flex-initial text-center justify-center px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  subTab === 'revenues' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Receitas
              </button>
              <button
                type="button"
                onClick={() => { setSubTab('expenses'); setFilterPayment('all'); }}
                className={`flex-1 sm:flex-initial text-center justify-center px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  subTab === 'expenses' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Despesas
              </button>
              <button
                type="button"
                onClick={() => { setSubTab('projects'); setFilterPayment('all'); }}
                className={`flex-1 sm:flex-initial text-center justify-center px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  subTab === 'projects' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Lucro por Projeto
              </button>
            </div>

            {/* Botão de Nova Receita (Apenas na aba Receitas) */}
            {subTab === 'revenues' && (
              <button
                onClick={openNewRevenueModal}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer w-full sm:w-auto"
              >
                <Plus size={14} />
                Registrar Receita
              </button>
            )}

            {/* Botão de Novo Gasto (Apenas na aba Despesas) */}
            {subTab === 'expenses' && (
              <button
                onClick={openNewExpenseModal}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer w-full sm:w-auto"
              >
                <Plus size={14} />
                Registrar Gasto
              </button>
            )}
          </div>
        </div>

        <div className="w-full h-[1px] bg-white/15" />

        {/* Filtros de Pagamento da Tabela */}
        {subTab !== 'projects' && (
          <div className="flex gap-2 p-1 bg-black/40 border border-white/10 rounded-xl w-fit">
            <button
              onClick={() => setFilterPayment('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                filterPayment === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterPayment('paid')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                filterPayment === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              {subTab === 'revenues' ? 'Pagos' : 'Gastos Pagos'}
            </button>
            <button
              onClick={() => setFilterPayment('unpaid')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                filterPayment === 'unpaid' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              {subTab === 'revenues' ? 'Pendentes' : 'Gastos Pendentes'}
            </button>
          </div>
        )}

        {/* Renderização da Tabela de Receitas */}
        {subTab === 'revenues' && (
          combinedRevenues.length === 0 ? (
            <div className="py-16 text-center bg-black/20 border border-white/5 rounded-2xl">
              <DollarSign size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nenhum Registro de Receita</p>
              <p className="text-[11px] text-gray-600 mt-1">Nenhuma receita ou agendamento de cliente atende a este filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider font-mono">
                    <th className="pb-3 font-semibold">Data / Freq</th>
                    <th className="pb-3 font-semibold">Categoria</th>
                    <th className="pb-3 font-semibold">Descrição</th>
                    <th className="pb-3 font-semibold">Valor</th>
                    <th className="pb-3 font-semibold">Recorrência</th>
                    <th className="pb-3 font-semibold">Situação</th>
                    <th className="pb-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedRevenues.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 text-xs font-medium font-mono text-gray-300">
                        {item.type === 'fixo' ? (
                          <span>Dia {new Date(item.date + 'T12:00:00').getDate()}</span>
                        ) : (
                          <span>{item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          item.category === 'Agendamento' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' :
                          item.category === 'Mensalidade' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                          item.category === 'Venda de Produto' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          item.category === 'Serviço Adicional' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-bold text-white">
                        {item.description}
                      </td>
                      <td className="py-4 text-xs font-bold text-emerald-400 font-mono">
                        + R$ {item.value?.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                          item.type === 'fixo' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {item.type === 'fixo' ? 'FIXO MENSAL' : 'PONTUAL'}
                        </span>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => item.isAppointment ? handleTogglePaymentStatus(item.id, item.status) : handleToggleRevenueStatus(item.id, item.status)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all ${
                            item.status === 'paid' 
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' 
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {item.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                        </button>
                      </td>
                      <td className="py-4 text-right space-x-1.5">
                        {item.isAppointment ? (
                          item.clientPhone && (
                            <a
                              href={`https://wa.me/${item.clientPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                            >
                              <Phone size={12} />
                              WhatsApp
                            </a>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => openEditRevenueModal(item)}
                              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center"
                              title="Editar receita"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteRevenue(item.id)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center"
                              title="Excluir receita"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Renderização da Tabela de Despesas */}
        {subTab === 'expenses' && (
          filteredExpenses.length === 0 ? (
            <div className="py-16 text-center bg-black/20 border border-white/5 rounded-2xl">
              <TrendingDown size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nenhum Registro de Gasto</p>
              <p className="text-[11px] text-gray-600 mt-1">Registre as despesas da sua empresa clicando em "Registrar Gasto".</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider font-mono">
                    <th className="pb-3 font-semibold">Data / Freq</th>
                    <th className="pb-3 font-semibold">Categoria</th>
                    <th className="pb-3 font-semibold">Descrição</th>
                    <th className="pb-3 font-semibold">Valor</th>
                    <th className="pb-3 font-semibold">Recorrência</th>
                    <th className="pb-3 font-semibold">Situação</th>
                    <th className="pb-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 text-xs font-medium font-mono text-gray-300">
                        {exp.type === 'fixo' ? (
                          <span>Dia {new Date(exp.date + 'T12:00:00').getDate()}</span>
                        ) : (
                          <span>{exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          exp.category === 'Aluguel' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          exp.category === 'Maquinário' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          exp.category === 'Ferramentas' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          exp.category === 'Insumos' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                          'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-bold text-white">
                        {exp.description}
                      </td>
                      <td className="py-4 text-xs font-bold text-red-400 font-mono">
                        - R$ {exp.value?.toFixed(2).replace('.', ',')}
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                          exp.type === 'fixo' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {exp.type === 'fixo' ? 'FIXO MENSAL' : 'PONTUAL'}
                        </span>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleToggleExpenseStatus(exp.id, exp.status)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer active:scale-95 transition-all ${
                            exp.status === 'paid' 
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' 
                              : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
                          }`}
                        >
                          {exp.status === 'paid' ? 'PAGO' : 'PENDENTE'}
                        </button>
                      </td>
                      <td className="py-4 text-right space-x-1.5">
                        <button
                          onClick={() => openEditExpenseModal(exp)}
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center"
                          title="Editar gasto"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 hover:border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all cursor-pointer active:scale-90 inline-flex items-center justify-center"
                          title="Excluir gasto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Renderização da Tabela/Cards de Lucro por Projeto */}
        {subTab === 'projects' && (
          appointmentsFiltered.length === 0 ? (
            <div className="py-16 text-center bg-black/20 border border-white/5 rounded-2xl">
              <Calendar size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nenhum Agendamento no Período</p>
              <p className="text-[11px] text-gray-600 mt-1">Nenhum projeto ou agendamento concluído foi encontrado para o período selecionado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {appointmentsFiltered.map((app) => {
                // Filtra despesas vinculadas a este agendamento no Firestore
                const appExpenses = expenses.filter(e => e.appointmentId === app.id);
                const appExpensesTotal = appExpenses.reduce((sum, e) => sum + e.value, 0);

                // Busca serviço para obter o custo de insumos
                const srv = services.find(s => s.id === app.serviceId);
                let appMaterialsCost = 0;
                if (srv && srv.materials && Array.isArray(srv.materials)) {
                  srv.materials.forEach((m: any) => {
                    const invItem = inventory.find(i => i.id === m.itemId);
                    const costUnit = invItem ? (invItem.costPerUnit || 0) : 0;
                    appMaterialsCost += m.quantity * costUnit;
                  });
                }

                const appRevenue = app.price || 0;
                const appTotalCost = appExpensesTotal + appMaterialsCost;
                const appNetProfit = appRevenue - appTotalCost;
                const appMargin = appRevenue > 0 ? (appNetProfit / appRevenue) * 100 : 0;

                // Estilo dos badges de lucratividade
                let performanceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                let performanceLabel = 'Altamente Lucrativo';
                
                if (appMargin < 20) {
                  performanceColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                  performanceLabel = 'Alerta de Margem';
                } else if (appMargin >= 20 && appMargin <= 50) {
                  performanceColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                  performanceLabel = 'Margem Saudável';
                }

                return (
                  <div key={app.id} className="bg-black/30 border border-white/10 hover:border-white/20 p-6 rounded-[2rem] flex flex-col justify-between shadow-xl transition-all duration-300">
                    <div>
                      {/* Header Card */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-base truncate">{app.clientName}</h4>
                          <span className="text-[10px] text-gray-500 font-bold font-mono">
                            {app.date ? new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''} &bull; {app.time}
                          </span>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tight ${performanceColor}`}>
                          {performanceLabel}
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-4">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Serviço Realizado</span>
                        <span className="text-sm font-bold text-white">{app.serviceName}</span>
                      </div>

                      {/* Quebra Financeira */}
                      <div className="space-y-2 text-xs border-t border-white/5 pt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Valor Cobrado (Faturamento):</span>
                          <span className="text-gray-200 font-mono font-bold">R$ {appRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Custo de Insumos (Estoque):</span>
                          <span className="text-gray-400 font-mono font-medium">- R$ {appMaterialsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Despesas Extras (Lançadas):</span>
                          <span className="text-gray-400 font-mono font-medium">- R$ {appExpensesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-2 font-bold text-sm">
                          <span className="text-gray-300">Lucro Líquido Real:</span>
                          <span className={`${appNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-mono`}>
                            R$ {appNetProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Exibe detalhes se houver despesas extras */}
                    {appExpenses.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/5 space-y-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Detalhamento de Gastos:</span>
                        {appExpenses.map(exp => (
                          <div key={exp.id} className="flex justify-between text-[10px] text-gray-400 font-medium animate-in fade-in duration-150">
                            <span className="truncate pr-4">{exp.description}</span>
                            <span className="text-rose-400 shrink-0 font-mono">- R$ {exp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Modal Glassmorphism de Cadastro e Edição de Gasto */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setIsExpenseModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-6 text-left">
              <h3 className="text-xl font-bold text-white mb-1">
                {editingExpenseId ? 'Editar Gasto' : 'Registrar Gasto'}
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                {editingExpenseId ? 'Ajuste os dados do gasto selecionado.' : 'Informe a saída financeira para ajustar o lucro líquido da empresa.'}
              </p>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-left">
              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição do Gasto</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Ex: Compra de insumos capilares"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Valor */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor (R$)</label>
                  <input
                    type="text"
                    value={expenseValue}
                    onChange={(e) => setExpenseValue(e.target.value)}
                    placeholder="150,00"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 font-mono"
                    required
                  />
                </div>

                {/* Categoria */}
                  <CustomSelect
                    value={expenseCategory}
                    onChange={(val) => setExpenseCategory(val)}
                    options={[
                      { value: 'Aluguel', label: 'Aluguel' },
                      { value: 'Maquinário', label: 'Maquinário' },
                      { value: 'Ferramentas', label: 'Ferramentas' },
                      { value: 'Insumos', label: 'Insumos' },
                      { value: 'Outros', label: 'Outros' }
                    ]}
                  />
              </div>

                {/* Tipo de Gasto */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Frequência</label>
                  <CustomSelect
                    value={expenseType}
                    onChange={(val) => setExpenseType(val as any)}
                    options={[
                      { value: 'pontual', label: 'Gasto Pontual (Único)' },
                      { value: 'fixo', label: 'Fixo Mensal (Recorrente)' }
                    ]}
                  />
                </div>

                {/* Situação */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Situação</label>
                  <CustomSelect
                    value={expenseStatus}
                    onChange={(val) => setExpenseStatus(val as any)}
                    options={[
                      { value: 'paid', label: 'Pago' },
                      { value: 'unpaid', label: 'Pendente' }
                    ]}
                  />
                </div>

              {/* Data (Original de Lançamento ou de início do Gasto Fixo) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {expenseType === 'fixo' ? 'Data de Início do Gasto Fixo' : 'Data do Gasto'}
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500"
                  required
                />
                {expenseType === 'fixo' && (
                  <p className="text-[9px] text-gray-400 italic mt-0.5">
                    O gasto incidirá automaticamente todo dia {new Date(expenseDate + 'T12:00:00').getDate()} a partir desta data.
                  </p>
                )}
              </div>

              {/* Vincular a Agendamento (Projeto) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vincular a Agendamento (Opcional)</label>
                <CustomSelect
                  value={expenseAppointmentId}
                  onChange={(val) => setExpenseAppointmentId(val)}
                  placeholder="Nenhum (Gasto Geral)"
                  options={appointments.map(app => ({
                    value: app.id,
                    label: `${app.clientName} - ${app.serviceName} (${app.date ? new Date(app.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''})`
                  }))}
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-white/10 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingExpense ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>{editingExpenseId ? 'Atualizar Gasto' : 'Salvar Gasto'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Glassmorphism de Cadastro e Edição de Receita */}
      {isRevenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-3xl md:rounded-[2.5rem] max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <button
              onClick={() => setIsRevenueModalOpen(false)}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="mb-6 text-left">
              <h3 className="text-xl font-bold text-white mb-1">
                {editingRevenueId ? 'Editar Receita' : 'Registrar Receita'}
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                {editingRevenueId ? 'Ajuste os dados da receita selecionada.' : 'Informe a receita financeira para ajustar o faturamento e lucro líquido da empresa.'}
              </p>
            </div>

            <form onSubmit={handleSaveRevenue} className="space-y-4 text-left">
              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Descrição da Receita</label>
                <input
                  type="text"
                  value={revenueDesc}
                  onChange={(e) => setRevenueDesc(e.target.value)}
                  placeholder="Ex: Consultoria Extra"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Valor */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor (R$)</label>
                  <input
                    type="text"
                    value={revenueValue}
                    onChange={(e) => setRevenueValue(e.target.value)}
                    placeholder="150,00"
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 hover:border-white/20 focus:border-primary-500 text-white rounded-xl text-sm outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-primary-500 font-mono"
                    required
                  />
                </div>

                {/* Categoria */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Categoria</label>
                  <CustomSelect
                    value={revenueCategory}
                    onChange={(val) => setRevenueCategory(val)}
                    options={[
                      { value: 'Mensalidade', label: 'Mensalidade' },
                      { value: 'Venda de Produto', label: 'Venda de Produto' },
                      { value: 'Serviço Adicional', label: 'Serviço Adicional' },
                      { value: 'Outros', label: 'Outros' }
                    ]}
                  />
                </div>
              </div>

                {/* Tipo de Receita */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Frequência</label>
                  <CustomSelect
                    value={revenueType}
                    onChange={(val) => setRevenueType(val as any)}
                    options={[
                      { value: 'pontual', label: 'Receita Pontual (Único)' },
                      { value: 'fixo', label: 'Fixo Mensal (Recorrente)' }
                    ]}
                  />
                </div>

                {/* Situação */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Situação</label>
                  <CustomSelect
                    value={revenueStatus}
                    onChange={(val) => setRevenueStatus(val as any)}
                    options={[
                      { value: 'paid', label: 'Pago' },
                      { value: 'unpaid', label: 'Pendente' }
                    ]}
                  />
                </div>

              {/* Data */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {revenueType === 'fixo' ? 'Data de Início da Receita Fixa' : 'Data da Receita'}
                </label>
                <input
                  type="date"
                  value={revenueDate}
                  onChange={(e) => setRevenueDate(e.target.value)}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white rounded-xl text-sm outline-none transition-all focus:border-primary-500"
                  required
                />
                {revenueType === 'fixo' && (
                  <p className="text-[9px] text-gray-400 italic mt-0.5">
                    A receita incidirá automaticamente todo dia {new Date(revenueDate + 'T12:00:00').getDate()} a partir desta data.
                  </p>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsRevenueModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-white/10 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRevenue}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {savingRevenue ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>{editingRevenueId ? 'Atualizar Receita' : 'Salvar Receita'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmModal({ isOpen: false, type: '', itemId: '', title: '', message: '' })}
      />

      {/* Modal de Fechamento do Mês (Impressão A4) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto print:absolute print:inset-0 print:bg-white print:text-black print:p-0 print:m-0 print:overflow-visible print:static">
          
          <div className="relative w-full max-w-4xl bg-[#0f1115] border border-white/10 rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col max-h-screen md:max-h-[92vh] overflow-y-auto custom-scrollbar print:border-none print:bg-white print:text-black print:max-h-none print:w-full print:rounded-none print:shadow-none print:overflow-visible print:static">
            
            {/* Header (Oculto na Impressão) */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Relatório de Fechamento</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Visualização Pré-Impressão</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10 active:scale-95"
                >
                  <ExternalLink size={12} />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Folha A4 do Relatório */}
            <div className="flex-1 p-8 md:p-12 bg-white text-black font-sans print:p-0 print:m-0">
              
              {/* Cabeçalho do Relatório */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-black pb-6 gap-6">
                <div>
                  <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">Relatório de Fechamento</h1>
                  <span className="text-xs font-bold text-gray-600 block mt-1">
                    Período: {
                      filterPeriod === 'today' ? 'Hoje' :
                      filterPeriod === 'week' ? 'Esta Semana' :
                      filterPeriod === 'month' ? 'Este Mês' :
                      filterPeriod === 'last_month' ? 'Mês Passado' : 'Histórico Geral'
                    }
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    Data de Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  <h2 className="text-sm font-black text-black uppercase">{client.name}</h2>
                  <span className="text-[10px] text-gray-500 block">Gestão Simplificada no Portal Hub</span>
                </div>
              </div>

              {/* Tabela de Indicadores */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-8">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">Faturamento Projetado</span>
                  <span className="text-base font-black text-black block mt-1">
                    R$ {totalProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider block">Receitas Recebidas</span>
                  <span className="text-base font-black text-emerald-700 block mt-1">
                    R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                  <span className="text-[8px] font-black text-red-600 uppercase tracking-wider block">Despesas Totais</span>
                  <span className="text-base font-black text-red-700 block mt-1">
                    R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">Lucro Líquido</span>
                  <span className={`text-base font-black block mt-1 ${lucroLiquido >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    R$ {lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl col-span-2 md:col-span-1">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-wider block">Margem de Lucro</span>
                  <span className="text-base font-black text-black block mt-1">
                    {totalPago > 0 ? ((lucroLiquido / totalPago) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>

              {/* Detalhamento de Entradas */}
              <div className="space-y-3 pb-8">
                <h3 className="text-xs font-black uppercase tracking-wider border-b border-gray-300 pb-1.5 text-black">
                  Detalhamento de Entradas (Receitas)
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] text-gray-500 font-bold uppercase">
                      <th className="py-2 w-24">Data</th>
                      <th className="py-2">Descrição</th>
                      <th className="py-2 w-32">Categoria</th>
                      <th className="py-2 w-28 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {combinedRevenues.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400 italic">Nenhuma entrada registrada neste período.</td>
                      </tr>
                    ) : (
                      combinedRevenues.map((rev) => (
                        <tr key={rev.id} className="text-black">
                          <td className="py-2 font-mono">{rev.date ? new Date(rev.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</td>
                          <td className="py-2">{rev.description}</td>
                          <td className="py-2 text-gray-600">{rev.category}</td>
                          <td className="py-2 text-right font-bold">R$ {rev.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Detalhamento de Saídas */}
              <div className="space-y-3 pb-12">
                <h3 className="text-xs font-black uppercase tracking-wider border-b border-gray-300 pb-1.5 text-black">
                  Detalhamento de Saídas (Despesas)
                </h3>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] text-gray-500 font-bold uppercase">
                      <th className="py-2 w-24">Data</th>
                      <th className="py-2">Descrição</th>
                      <th className="py-2 w-32">Categoria</th>
                      <th className="py-2 w-28 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-400 italic">Nenhuma saída registrada neste período.</td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="text-black">
                          <td className="py-2 font-mono">{exp.date ? new Date(exp.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</td>
                          <td className="py-2">{exp.description}</td>
                          <td className="py-2 text-gray-600">{exp.category}</td>
                          <td className="py-2 text-right font-bold text-red-600">R$ {exp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Assinatura no Rodapé (Espaço Executivo) */}
              <div className="border-t border-gray-300 pt-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-left">
                  <span className="text-[9px] text-gray-400 font-bold uppercase block">Portal Hub - Sistema de CRM e Gestão</span>
                  <span className="text-[9px] text-gray-500 block mt-0.5">Relatório gerado de forma segura e auditada.</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-48 border-b border-black text-center pb-1 font-mono text-[10px]">
                    {new Date().toLocaleDateString('pt-BR')}
                  </div>
                  <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1.5">Data da Assinatura</span>
                </div>
              </div>

            </div>

            {/* Rodapé (Oculto na Impressão) */}
            <div className="p-6 border-t border-white/5 bg-white/5 text-right print:hidden">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 transition-all cursor-pointer"
              >
                Voltar ao Painel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
