import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { 
  Users, Search, Plus, Phone, Mail, Calendar, FileText, Trash2, X, Edit2, AlertCircle, Check, DollarSign, Clock, Tag, User, PawPrint, Car
} from 'lucide-react';
import { toast } from 'sonner';

interface PortalClientsProps {
  orgId: string;
  clientId: string;
  client?: any;
  userProfile?: any;
}

export default function PortalClients({ orgId, clientId, client, userProfile }: PortalClientsProps) {
  // Listas de Dados do Firestore
  const [appointments, setAppointments] = useState<any[]>([]);
  const [deletedClientsPhones, setDeletedClientsPhones] = useState<string[]>([]);
  const [manualClients, setManualClients] = useState<any[]>([]);
  const [customFieldsDef, setCustomFieldsDef] = useState<any[]>([]);
  const [fidelitySettingsObj, setFidelitySettingsObj] = useState<any>({});
  
  // Lista Consolidada Reativa
  const [consolidatedClients, setConsolidatedClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Modais de Cadastro / Edição
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);

  // Estados locais dos formulários de cadastro
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [localCustomFieldsDef, setLocalCustomFieldsDef] = useState<string[]>([]);
  const [modalCustomFields, setModalCustomFields] = useState<Record<string, string>>({});
  
  // Estado para criação rápida de novos campos dinâmicos no modal
  const [newFieldName, setNewFieldName] = useState('');
  const [showAddNewFieldInput, setShowAddNewFieldInput] = useState(false);

  // Modais de confirmação
  const [deleteClientConfirm, setDeleteClientConfirm] = useState<{ isOpen: boolean; client: any | null }>({
    isOpen: false,
    client: null
  });

  // Ativação do Módulo de Pets e Veículos
  const isPetsActive = userProfile?.modulesConfig?.activeModules?.clients_pets !== false;
  const isVehiclesActive = userProfile?.modulesConfig?.activeModules?.clients_vehicles !== false;

  // Estados para Controle de Sub-abas e Inativos
  const [crmListType, setCrmListType] = useState<'all' | 'inactive'>('all');
  const [inactiveClientsData, setInactiveClientsData] = useState<Record<string, { daysInactive: number, lastDateStr: string }>>({});
  const [selectedClientSubTab, setSelectedClientSubTab] = useState<'info' | 'pets' | 'vehicles'>('info');

  // Modal / Formulário de Cadastro/Edição de Pet
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [editingPet, setEditingPet] = useState<any | null>(null);
  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState('dog');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petNotes, setPetNotes] = useState('');

  // Modal de Confirmação para deletar Pet
  const [deletePetConfirm, setDeletePetConfirm] = useState<{ isOpen: boolean; petId: string }>({
    isOpen: false,
    petId: ''
  });

  // Modal / Formulário de Cadastro/Edição de Veículo
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any | null>(null);
  const [vehicleBrandModel, setVehicleBrandModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleKm, setVehicleKm] = useState('');
  const [vehicleNotes, setVehicleNotes] = useState('');

  // Modal de Confirmação para deletar Veículo
  const [deleteVehicleConfirm, setDeleteVehicleConfirm] = useState<{ isOpen: boolean; vehicleId: string }>({
    isOpen: false,
    vehicleId: ''
  });

  // 1. Escutar agendamentos da organização (appointments)
  useEffect(() => {
    if (!orgId) return;
    const ref = collection(db, 'organizations', orgId, 'appointments');
    const q = query(ref);
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAppointments(list);
    }, (error) => {
      console.warn("Erro ao escutar agendamentos no PortalClients:", error.message);
    });
    return () => unsub();
  }, [orgId]);

  // 2. Escutar dados do perfil do profissional logado (clientes manuais, deletados e campos customizados de fidelitySettings)
  useEffect(() => {
    if (!orgId || !clientId) return;

    const docRef = doc(db, 'organizations', orgId, 'clients', clientId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fid = data.fidelitySettings || {};
        setFidelitySettingsObj(fid);
        setManualClients(fid.crmClients || []);
        setDeletedClientsPhones(fid.crmDeletedPhones || []);

        const list = fid.crmCustomFieldsDef || [];
        const sortedList = [...list].sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        setCustomFieldsDef(sortedList);
      }
    }, (error) => {
      console.warn("Erro ao escutar dados do perfil no PortalClients:", error.message);
    });
    return () => unsub();
  }, [orgId, clientId]);

  // 3. Consolidar lista de clientes finais únicos (manual + agendamentos)
  useEffect(() => {
    const clientsMap = new Map<string, { id: string; name: string; phone: string; email?: string }>();

    // Primeiro populamos com clientes manuais vindos do perfil
    manualClients.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      if (cleanPhone) {
        clientsMap.set(cleanPhone, {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          email: c.email || ''
        });
      }
    });

    // Depois adicionamos / atualizamos com base nos agendamentos
    appointments.forEach(app => {
      if (app.clientPhone && app.clientName && app.serviceId !== 'bloqueio') {
        const cleanPhone = app.clientPhone.replace(/\D/g, '');
        if (cleanPhone && !clientsMap.has(cleanPhone)) {
          clientsMap.set(cleanPhone, {
            id: `appt-${cleanPhone}`,
            name: app.clientName,
            phone: app.clientPhone,
            email: app.clientEmail || ''
          });
        }
      }
    });

    // Ordenar por nome e FILTRAR os telefones deletados, além de ocultar a profissional Julia/clientId
    const sorted = Array.from(clientsMap.values())
      .filter(c => {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        const hasActiveAppt = appointments.some(app => {
          const appPhone = (app.clientPhone || '').replace(/\D/g, '');
          return appPhone === cleanPhone && app.status !== 'cancelled' && app.serviceId !== 'bloqueio';
        });
        const isDeleted = deletedClientsPhones.includes(cleanPhone) && !hasActiveAppt;
        return !isDeleted && cleanPhone !== '11914573272' && c.id !== clientId;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    setConsolidatedClients(sorted);
  }, [manualClients, appointments, deletedClientsPhones, clientId]);

  // Filtrar Lista de Clientes com base na Pesquisa
  const filteredClients = consolidatedClients.filter(c => {
    const queryStr = searchQuery.toLowerCase();
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    return c.name.toLowerCase().includes(queryStr) || cleanPhone.includes(queryStr);
  });

  // Identificar cliente selecionado
  const selectedClient = consolidatedClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);

  // Obter prontuário/customFields do cliente selecionado
  const selectedManualClient = manualClients.find(c => (c.phone || '').replace(/\D/g, '') === selectedClientId);
  const selectedCustomFields = selectedManualClient?.customFields || {};

  // Filtrar agendamentos do cliente selecionado
  const selectedClientAppointments = selectedClient ? appointments
    .filter(app => {
      const appPhone = (app.clientPhone || '').replace(/\D/g, '');
      const clientPhone = (selectedClient.phone || '').replace(/\D/g, '');
      return appPhone === clientPhone && app.serviceId !== 'bloqueio';
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(`${a.date}T${a.time || '00:00'}`).getTime() : 0;
      const dateB = b.date ? new Date(`${b.date}T${b.time || '00:00'}`).getTime() : 0;
      return dateB - dateA; // Decrescente (mais recente primeiro)
    }) : [];

  // Sincronizar dados do CRM via API de portal_handler
  const syncCrmData = async (payload: { crmClients?: any[], crmCustomFieldsDef?: any[], crmDeletedPhones?: string[] }) => {
    if (!orgId || !clientId) return;
    
    const token = localStorage.getItem('portalToken') || sessionStorage.getItem('portalToken') || '';
    const crmApiUrl = import.meta.env.VITE_CRM_API_URL || 'https://hubcrm.hubsymples.com.br';
    const currentUser = auth.currentUser;

    const response = await fetch(`${crmApiUrl}/api/portal_handler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_client',
        orgId,
        clientId,
        token,
        uid: currentUser?.uid || '',
        email: currentUser?.email || '',
        fidelitySettings: {
          ...fidelitySettingsObj,
          ...payload
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao sincronizar dados com o servidor.');
    }
  };

  // Controle de Modal / Ações de Pets
  const openPetModal = (pet: any = null) => {
    setEditingPet(pet);
    if (pet) {
      setPetName(pet.name || '');
      setPetType(pet.type || 'dog');
      setPetBreed(pet.breed || '');
      setPetAge(pet.age || '');
      setPetWeight(pet.weight || '');
      setPetNotes(pet.notes || '');
    } else {
      setPetName('');
      setPetType('dog');
      setPetBreed('');
      setPetAge('');
      setPetWeight('');
      setPetNotes('');
    }
    setIsPetModalOpen(true);
  };

  const handleSavePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast.error('Nenhum tutor selecionado.');
      return;
    }
    if (!petName.trim()) {
      toast.error('O nome do pet é obrigatório.');
      return;
    }

    setIsSavingPet(true);
    try {
      let currentCrmList = [...(fidelitySettingsObj.crmClients || [])];
      const cleanSelectedPhone = (selectedClient.phone || '').replace(/\D/g, '');

      // Localiza o cadastro manual ou cria um novo com base no selecionado (se ele veio da agenda)
      let manualIndex = currentCrmList.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanSelectedPhone);
      
      let clientTarget: any;
      if (manualIndex >= 0) {
        clientTarget = { ...currentCrmList[manualIndex] };
      } else {
        // Converte em manual para podermos salvar os pets
        clientTarget = {
          id: `manual_${Date.now()}`,
          name: selectedClient.name,
          phone: selectedClient.phone,
          email: selectedClient.email || '',
          birthday: '',
          notes: '',
          createdAt: new Date().toISOString(),
          customFields: {},
          pets: []
        };
      }

      const clientPets = Array.isArray(clientTarget.pets) ? [...clientTarget.pets] : [];

      if (editingPet) {
        // Atualizando Pet existente
        const petIndex = clientPets.findIndex(p => p.id === editingPet.id);
        if (petIndex >= 0) {
          clientPets[petIndex] = {
            ...clientPets[petIndex],
            name: petName.trim(),
            type: petType,
            breed: petBreed.trim(),
            age: petAge.trim(),
            weight: petWeight.trim(),
            notes: petNotes.trim(),
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        // Adicionando novo Pet
        const newPet = {
          id: `pet_${Date.now()}`,
          name: petName.trim(),
          type: petType,
          breed: petBreed.trim(),
          age: petAge.trim(),
          weight: petWeight.trim(),
          notes: petNotes.trim(),
          createdAt: new Date().toISOString()
        };
        clientPets.push(newPet);
      }

      clientTarget.pets = clientPets;

      if (manualIndex >= 0) {
        currentCrmList[manualIndex] = clientTarget;
      } else {
        currentCrmList.push(clientTarget);
      }

      // Sincroniza com Firestore / Backend
      await syncCrmData({ crmClients: currentCrmList });
      toast.success(editingPet ? 'Pet atualizado com sucesso!' : 'Pet cadastrado com sucesso!');
      setIsPetModalOpen(false);
      setEditingPet(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar informações do pet.');
    } finally {
      setIsSavingPet(false);
    }
  };

  const executeDeletePet = async (petId: string) => {
    if (!selectedClient) return;
    try {
      let currentCrmList = [...(fidelitySettingsObj.crmClients || [])];
      const cleanSelectedPhone = (selectedClient.phone || '').replace(/\D/g, '');
      const manualIndex = currentCrmList.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanSelectedPhone);

      if (manualIndex >= 0) {
        const clientTarget = { ...currentCrmList[manualIndex] };
        const clientPets = Array.isArray(clientTarget.pets) ? [...clientTarget.pets] : [];
        const filteredPets = clientPets.filter(p => p.id !== petId);
        clientTarget.pets = filteredPets;
        currentCrmList[manualIndex] = clientTarget;

        await syncCrmData({ crmClients: currentCrmList });
        toast.success('Pet removido com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao remover pet.');
    } finally {
      setDeletePetConfirm({ isOpen: false, petId: '' });
    }
  };

  // Controle de Modal / Ações de Veículos
  const openVehicleModal = (vehicle: any = null) => {
    setEditingVehicle(vehicle);
    if (vehicle) {
      setVehicleBrandModel(vehicle.brandModel || '');
      setVehiclePlate(vehicle.plate || '');
      setVehicleYear(vehicle.year || '');
      setVehicleColor(vehicle.color || '');
      setVehicleKm(vehicle.km || '');
      setVehicleNotes(vehicle.notes || '');
    } else {
      setVehicleBrandModel('');
      setVehiclePlate('');
      setVehicleYear('');
      setVehicleColor('');
      setVehicleKm('');
      setVehicleNotes('');
    }
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      toast.error('Nenhum proprietário selecionado.');
      return;
    }
    if (!vehicleBrandModel.trim()) {
      toast.error('Marca/Modelo do veículo é obrigatório.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      let currentCrmList = [...(fidelitySettingsObj.crmClients || [])];
      const cleanSelectedPhone = (selectedClient.phone || '').replace(/\D/g, '');

      // Localiza o cadastro manual ou cria um novo com base no selecionado (se ele veio da agenda)
      let manualIndex = currentCrmList.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanSelectedPhone);
      
      let clientTarget: any;
      if (manualIndex >= 0) {
        clientTarget = { ...currentCrmList[manualIndex] };
      } else {
        // Converte em manual para podermos salvar os veículos
        clientTarget = {
          id: `manual_${Date.now()}`,
          name: selectedClient.name,
          phone: selectedClient.phone,
          email: selectedClient.email || '',
          birthday: '',
          notes: '',
          createdAt: new Date().toISOString(),
          customFields: {},
          pets: [],
          vehicles: []
        };
      }

      const clientVehicles = Array.isArray(clientTarget.vehicles) ? [...clientTarget.vehicles] : [];

      if (editingVehicle) {
        // Atualizando Veículo existente
        const vehicleIndex = clientVehicles.findIndex(v => v.id === editingVehicle.id);
        if (vehicleIndex >= 0) {
          clientVehicles[vehicleIndex] = {
            ...clientVehicles[vehicleIndex],
            brandModel: vehicleBrandModel.trim(),
            plate: vehiclePlate.trim(),
            year: vehicleYear.trim(),
            color: vehicleColor.trim(),
            km: vehicleKm.trim(),
            notes: vehicleNotes.trim(),
            updatedAt: new Date().toISOString()
          };
        }
      } else {
        // Adicionando novo Veículo
        const newVehicle = {
          id: `vehicle_${Date.now()}`,
          brandModel: vehicleBrandModel.trim(),
          plate: vehiclePlate.trim(),
          year: vehicleYear.trim(),
          color: vehicleColor.trim(),
          km: vehicleKm.trim(),
          notes: vehicleNotes.trim(),
          createdAt: new Date().toISOString()
        };
        clientVehicles.push(newVehicle);
      }

      clientTarget.vehicles = clientVehicles;

      if (manualIndex >= 0) {
        currentCrmList[manualIndex] = clientTarget;
      } else {
        currentCrmList.push(clientTarget);
      }

      // Sincroniza com Firestore / Backend
      await syncCrmData({ crmClients: currentCrmList });
      toast.success(editingVehicle ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!');
      setIsVehicleModalOpen(false);
      setEditingVehicle(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar informações do veículo.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const executeDeleteVehicle = async (vehicleId: string) => {
    if (!selectedClient) return;
    try {
      let currentCrmList = [...(fidelitySettingsObj.crmClients || [])];
      const cleanSelectedPhone = (selectedClient.phone || '').replace(/\D/g, '');
      const manualIndex = currentCrmList.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanSelectedPhone);

      if (manualIndex >= 0) {
        const clientTarget = { ...currentCrmList[manualIndex] };
        const clientVehicles = Array.isArray(clientTarget.vehicles) ? [...clientTarget.vehicles] : [];
        const filteredVehicles = clientVehicles.filter(v => v.id !== vehicleId);
        clientTarget.vehicles = filteredVehicles;
        currentCrmList[manualIndex] = clientTarget;

        await syncCrmData({ crmClients: currentCrmList });
        toast.success('Veículo removido com sucesso!');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao remover veículo.');
    } finally {
      setDeleteVehicleConfirm({ isOpen: false, vehicleId: '' });
    }
  };

  // Abre modal de cadastro ou edição
  const openClientModal = (clientToEdit: any = null) => {
    setEditingClient(clientToEdit);
    setLocalCustomFieldsDef(customFieldsDef.map(f => typeof f === 'string' ? f : f.name));
    setShowAddNewFieldInput(false);
    setNewFieldName('');

    if (clientToEdit) {
      setNewClientName(clientToEdit.name);
      setNewClientPhone(clientToEdit.phone);
      setNewClientEmail(clientToEdit.email || '');
      const mClient = manualClients.find(c => (c.phone || '').replace(/\D/g, '') === (clientToEdit.phone || '').replace(/\D/g, ''));
      setModalCustomFields(mClient?.customFields || {});
    } else {
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setModalCustomFields({});
    }
    setIsClientModalOpen(true);
  };

  // Cria dinamicamente um novo campo extra na ficha no modal
  const handleAddLocalCustomField = () => {
    const nameTrim = newFieldName.trim();
    if (!nameTrim) return;
    if (localCustomFieldsDef.includes(nameTrim)) {
      toast.error('Este campo já existe no cadastro.');
      return;
    }
    setLocalCustomFieldsDef([...localCustomFieldsDef, nameTrim]);
    setNewFieldName('');
    setShowAddNewFieldInput(false);
    toast.success(`Campo "${nameTrim}" adicionado ao formulário!`);
  };

  // Remove um campo dinâmico do formulário
  const handleRemoveLocalCustomField = (fieldName: string) => {
    setLocalCustomFieldsDef(localCustomFieldsDef.filter(f => f !== fieldName));
    const updatedValues = { ...modalCustomFields };
    delete updatedValues[fieldName];
    setModalCustomFields(updatedValues);
  };

  // Abre modal de confirmação para exclusão de cliente
  const handleDeleteClient = (clientToDelete: any) => {
    setDeleteClientConfirm({ isOpen: true, client: clientToDelete });
  };

  // Executa exclusão de cliente
  const executeDeleteClient = async (clientToDelete: any) => {
    try {
      const cleanPhone = (clientToDelete.phone || '').replace(/\D/g, '');

      // Remove da lista de clientes manuais
      const updatedManualClientsList = manualClients.filter(c => (c.phone || '').replace(/\D/g, '') !== cleanPhone);

      // Adiciona o telefone na lista de excluídos
      let updatedDeletedPhones = deletedClientsPhones;
      if (cleanPhone && !deletedClientsPhones.includes(cleanPhone)) {
        updatedDeletedPhones = [...deletedClientsPhones, cleanPhone];
      }

      await syncCrmData({
        crmClients: updatedManualClientsList,
        crmDeletedPhones: updatedDeletedPhones
      });

      toast.success('Cliente excluído com sucesso!');
      if (selectedClientId === cleanPhone) {
        setSelectedClientId('');
      }
      setDeleteClientConfirm({ isOpen: false, client: null });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir cliente.');
    }
  };

  // Cadastro ou Edição de Cliente Final
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim()) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    setIsSavingClient(true);
    try {
      const cleanPhone = newClientPhone.replace(/\D/g, '');

      // Cria a nova definição de campos globais contendo os campos salvos
      const updatedGlobalFieldsDef = localCustomFieldsDef.map(fieldName => {
        const existing = customFieldsDef.find(f => (f.name || f) === fieldName);
        if (existing) return existing;
        return {
          id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: fieldName,
          createdAt: new Date().toISOString()
        };
      });

      let updatedList = [...manualClients];
      const existingManualIndex = manualClients.findIndex(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);

      if (existingManualIndex !== -1) {
        // Atualiza cliente existente no banco manual
        updatedList[existingManualIndex] = {
          ...updatedList[existingManualIndex],
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          customFields: modalCustomFields,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Verifica se já existe por telefone (para evitar duplicar registros no manual)
        const alreadyExists = manualClients.some(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (alreadyExists && !editingClient) {
          toast.error('Já existe um cliente cadastrado com esse telefone.');
          setIsSavingClient(false);
          return;
        }

        const newClientObj = {
          id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          customFields: modalCustomFields,
          createdAt: new Date().toISOString()
        };
        updatedList = [...updatedList, newClientObj];
      }

      await syncCrmData({
        crmClients: updatedList,
        crmCustomFieldsDef: updatedGlobalFieldsDef
      });

      toast.success(editingClient ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
      setSelectedClientId(cleanPhone);
      
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setEditingClient(null);
      setIsClientModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="text-purple-400" size={26} />
            Clientes
          </h2>
          <p className="text-xs text-gray-400 mt-1">Gerencie a ficha cadastral, contatos e histórico dos seus clientes.</p>
        </div>

        <button
          onClick={() => openClientModal()}
          className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0 shrink-0"
        >
          <Plus size={14} /> Cadastrar Cliente
        </button>
      </div>

      {/* Grid Principal de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Painel Esquerdo: Lista de Clientes */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-4 flex flex-col h-[650px]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="text-purple-400" size={18} />
              Meus Clientes
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Selecione para ver a ficha completa e o histórico.</p>
          </div>

          {/* Abas da Lista: Todos vs Sumidos */}
          <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-xl">
            <button
              onClick={() => setCrmListType('all')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border-0 cursor-pointer ${
                crmListType === 'all'
                  ? 'bg-purple-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setCrmListType('inactive')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border-0 cursor-pointer flex items-center justify-center gap-1.5 ${
                crmListType === 'inactive'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sumidos
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${crmListType === 'inactive' ? 'bg-black/30 text-rose-200' : 'bg-white/5 text-gray-500'}`}>
                {Object.keys(inactiveClientsData).length}
              </span>
            </button>
          </div>

          {/* Busca */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar client..."
              className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
            />
            <Search className="absolute right-3 top-2.5 text-gray-600" size={14} />
          </div>

          {/* Listagem */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
            {filteredClients.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/5 rounded-2xl">
                <Users size={32} className="mx-auto text-gray-700 mb-2" />
                <p className="text-[11px] text-gray-500 uppercase font-black tracking-widest">Nenhum Cliente</p>
                <p className="text-[10px] text-gray-600 mt-0.5">Nenhum contato encontrado no filtro.</p>
              </div>
            ) : (
              filteredClients.map((c) => {
                const cleanPhone = (c.phone || '').replace(/\D/g, '');
                const isSelected = selectedClientId === cleanPhone;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClientId(cleanPhone)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative overflow-hidden group ${
                      isSelected 
                        ? 'bg-purple-500/10 border-purple-500/30' 
                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 ${
                      isSelected ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400'
                    }`}>
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{c.phone}</p>
                      {inactiveClientsData[cleanPhone] && (
                        <span className="inline-block text-[8px] font-black uppercase text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded mt-1.5">
                          Sumido ({inactiveClientsData[cleanPhone].daysInactive}d)
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Ficha Detalhada & Histórico */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedClient ? (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-12 text-center h-[650px] flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400">
                <Users size={32} />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Ficha do Cliente</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">Selecione um cliente na lista à esquerda para carregar suas informações cadastrais, histórico de atendimentos e ficha personalizada.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl min-h-[650px] flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Cabeçalho do Cliente Selecionado */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-full flex items-center justify-center font-black text-lg uppercase shadow-inner">
                      {selectedClient.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">{selectedClient.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Phone size={12} className="text-purple-400" />
                          {selectedClient.phone}
                        </span>
                        {selectedClient.email && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail size={12} className="text-purple-400" />
                            {selectedClient.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openClientModal(selectedClient)}
                      className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={12} /> Editar Dados
                    </button>
                    <button
                      onClick={() => handleDeleteClient(selectedClient)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                      title="Excluir Cliente"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Banner de Reativação para Clientes Sumidos */}
                {inactiveClientsData[selectedClientId] && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-400">
                        <AlertCircle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-wider">Cliente Inativo (Sumido)</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-normal">
                        Este cliente não realiza atendimentos há <strong>{inactiveClientsData[selectedClientId].daysInactive} dias</strong> (última visita: {inactiveClientsData[selectedClientId].lastDateStr ? new Date(inactiveClientsData[selectedClientId].lastDateStr + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem registro'}).
                      </p>
                    </div>
                    <a
                      href={`https://wa.me/55${selectedClientId}?text=${encodeURIComponent(`Olá ${selectedClient.name}, tudo bem? Sentimos sua falta! Que tal agendarmos uma nova sessão para cuidarmos de você? 😊`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-rose-500/10 cursor-pointer border-0 shrink-0 text-center decoration-none"
                    >
                      <Phone size={12} /> Reativar WhatsApp
                    </a>
                  </div>
                )}

                {/* Abas de Informações do Cliente (Apenas se o módulo de Pets ou Veículos estiver ativo) */}
                {(isPetsActive || isVehiclesActive) && (
                  <div className="flex border-b border-white/5 gap-4 mb-4 overflow-x-auto scrollbar-none">
                    <button
                      onClick={() => setSelectedClientSubTab('info')}
                      className={`pb-2 text-xs font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer transition-all border-b-2 shrink-0
                        ${selectedClientSubTab === 'info' 
                          ? 'border-purple-500 text-purple-400 font-black' 
                          : 'border-transparent text-gray-500 hover:text-white'}`}
                    >
                      Informações Gerais
                    </button>
                    {isPetsActive && (
                      <button
                        onClick={() => setSelectedClientSubTab('pets')}
                        className={`pb-2 text-xs font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer transition-all border-b-2 flex items-center gap-1.5 shrink-0
                          ${selectedClientSubTab === 'pets' 
                            ? 'border-purple-500 text-purple-400 font-black' 
                            : 'border-transparent text-gray-500 hover:text-white'}`}
                      >
                        Pets / Pacientes
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${selectedClientSubTab === 'pets' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'}`}>
                          {selectedManualClient?.pets?.length || 0}
                        </span>
                      </button>
                    )}
                    {isVehiclesActive && (
                      <button
                        onClick={() => setSelectedClientSubTab('vehicles')}
                        className={`pb-2 text-xs font-bold uppercase tracking-wider bg-transparent border-0 cursor-pointer transition-all border-b-2 flex items-center gap-1.5 shrink-0
                          ${selectedClientSubTab === 'vehicles' 
                            ? 'border-purple-500 text-purple-400 font-black' 
                            : 'border-transparent text-gray-500 hover:text-white'}`}
                      >
                        Veículos
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${selectedClientSubTab === 'vehicles' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-gray-500'}`}>
                          {selectedManualClient?.vehicles?.length || 0}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {selectedClientSubTab === 'info' && (
                  <div className="space-y-6">
                    {/* Ficha Dinâmica (Campos Personalizados) */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={13} className="text-purple-400" />
                        Ficha do Cliente
                      </h4>

                      {customFieldsDef.length === 0 ? (
                        <div className="p-5 border border-dashed border-white/5 rounded-2xl text-center space-y-2">
                          <p className="text-[11px] text-gray-500">Nenhum campo personalizado cadastrado na ficha.</p>
                          <button
                            onClick={() => openClientModal(selectedClient)}
                            className="text-[11px] text-purple-400 hover:underline font-bold bg-transparent border-0 cursor-pointer"
                          >
                            + Criar Primeiro Campo Personalizado
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {customFieldsDef.map((fieldObj) => {
                            const fieldName = typeof fieldObj === 'string' ? fieldObj : fieldObj.name;
                            const value = selectedCustomFields[fieldName];

                            return (
                              <div key={fieldName} className="bg-black/20 border border-white/5 rounded-2xl p-4 space-y-1">
                                <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider block">{fieldName}</span>
                                <span className="text-xs text-white font-semibold">
                                  {value || <span className="text-gray-600 italic">Não informado</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Histórico de Agendamentos */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={13} className="text-purple-400" />
                        Histórico de Agendamentos ({selectedClientAppointments.length})
                      </h4>

                      {selectedClientAppointments.length === 0 ? (
                        <p className="text-[11px] text-gray-500 italic p-4 bg-black/10 rounded-xl">
                          Nenhum agendamento encontrado para este cliente na agenda.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                          {selectedClientAppointments.map((app) => {
                            const isCompleted = app.status === 'completed';
                            const isCancelled = app.status === 'cancelled';
                            const displayDate = app.date ? new Date(`${app.date}T00:00:00`).toLocaleDateString('pt-BR') : '';

                            return (
                              <div key={app.id} className="bg-black/10 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-white">{app.serviceName}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-400">
                                    <span className="flex items-center gap-0.5"><Calendar size={10} /> {displayDate}</span>
                                    <span className="flex items-center gap-0.5"><Clock size={10} /> {app.time}</span>
                                    {app.price > 0 && <span className="flex items-center gap-0.5"><DollarSign size={10} /> R$ {Number(app.price).toFixed(2).replace('.', ',')}</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {app.paymentMethod && (
                                    <span className="text-[9px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-lg border border-white/5 flex items-center gap-0.5">
                                      <Tag size={9} /> {app.paymentMethod === 'pacote' ? 'Pacote' : 'Venda Rápida'}
                                    </span>
                                  )}
                                  
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                    isCompleted 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : isCancelled
                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>
                                    {isCompleted ? 'Finalizado' : isCancelled ? 'Cancelado' : 'Agendado'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedClientSubTab === 'pets' && isPetsActive && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <PawPrint size={13} className="text-purple-400" />
                        Pets Cadastrados ({selectedManualClient?.pets?.length || 0})
                      </h4>
                      <button
                        onClick={() => openPetModal()}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 border-0 cursor-pointer"
                      >
                        <Plus size={10} /> Adicionar Pet
                      </button>
                    </div>

                    {(!selectedManualClient?.pets || selectedManualClient.pets.length === 0) ? (
                      <div className="p-8 border border-dashed border-white/5 rounded-[1.5rem] text-center space-y-2">
                        <PawPrint size={28} className="mx-auto text-gray-700 font-light" />
                        <p className="text-[11px] text-gray-500 font-semibold">Nenhum pet cadastrado para este tutor.</p>
                        <p className="text-[10px] text-gray-600">Cadastre os animais de estimação para guardar prontuários clínicos separados.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {selectedManualClient.pets.map((pet: any) => {
                          const icon = pet.type === 'dog' ? '🐶' : pet.type === 'cat' ? '🐱' : pet.type === 'bird' ? '🦜' : '🐾';
                          return (
                            <div key={pet.id} className="bg-black/20 border border-white/5 rounded-[1.5rem] p-4 flex flex-col justify-between gap-3 text-left">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-lg">
                                    {icon}
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-white uppercase">{pet.name}</h5>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-400">
                                      {pet.breed && <span>Raça: <strong>{pet.breed}</strong></span>}
                                      {pet.age && <span>Idade: <strong>{pet.age}</strong></span>}
                                      {pet.weight && <span>Peso: <strong>{pet.weight} kg</strong></span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openPetModal(pet)}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border-0 cursor-pointer"
                                    title="Editar Pet"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => setDeletePetConfirm({ isOpen: true, petId: pet.id })}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border-0 cursor-pointer"
                                    title="Excluir Pet"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                              {pet.notes && (
                                <div className="mt-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                                  <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-1">Prontuário / Observações</span>
                                  <p className="text-[10px] text-gray-300 whitespace-pre-wrap leading-relaxed">{pet.notes}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selectedClientSubTab === 'vehicles' && isVehiclesActive && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Car size={13} className="text-purple-400" />
                        Veículos Cadastrados ({selectedManualClient?.vehicles?.length || 0})
                      </h4>
                      <button
                        onClick={() => openVehicleModal()}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center gap-1 border-0 cursor-pointer"
                      >
                        <Plus size={10} /> Adicionar Veículo
                      </button>
                    </div>

                    {(!selectedManualClient?.vehicles || selectedManualClient.vehicles.length === 0) ? (
                      <div className="p-8 border border-dashed border-white/5 rounded-[1.5rem] text-center space-y-2">
                        <Car size={28} className="mx-auto text-gray-700 font-light" />
                        <p className="text-[11px] text-gray-500 font-semibold">Nenhum veículo cadastrado para este cliente.</p>
                        <p className="text-[10px] text-gray-600">Cadastre os veículos para associar orçamentos e históricos de manutenção.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {selectedManualClient.vehicles.map((vehicle: any) => {
                          return (
                            <div key={vehicle.id} className="bg-black/20 border border-white/5 rounded-[1.5rem] p-4 flex flex-col justify-between gap-3 text-left">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-lg">
                                    🚗
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-white uppercase">{vehicle.brandModel}</h5>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-gray-400">
                                      {vehicle.plate && <span>Placa: <strong className="text-purple-300">{vehicle.plate.toUpperCase()}</strong></span>}
                                      {vehicle.year && <span>Ano: <strong>{vehicle.year}</strong></span>}
                                      {vehicle.color && <span>Cor: <strong>{vehicle.color}</strong></span>}
                                      {vehicle.km && <span>KM: <strong>{vehicle.km} km</strong></span>}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openVehicleModal(vehicle)}
                                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border-0 cursor-pointer"
                                    title="Editar Veículo"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteVehicleConfirm({ isOpen: true, vehicleId: vehicle.id })}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border-0 cursor-pointer"
                                    title="Excluir Veículo"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                              {vehicle.notes && (
                                <div className="mt-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                                  <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest block mb-1">Histórico de Manutenções / Observações</span>
                                  <p className="text-[10px] text-gray-300 whitespace-pre-wrap leading-relaxed">{vehicle.notes}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Rodapé informativo */}
              <div className="text-[9px] text-gray-600 text-center border-t border-white/5 pt-4 mt-6">
                Ficha cadastrada em: {selectedManualClient?.createdAt ? new Date(selectedManualClient.createdAt).toLocaleDateString('pt-BR') : 'Importado da Agenda'}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Modal de Cadastro / Edição de Cliente */}
      {isClientModalOpen && (
        <div 
          onClick={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
            setNewClientName('');
            setNewClientPhone('');
            setNewClientEmail('');
            setModalCustomFields({});
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-lg w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="text-purple-400" size={18} />
                  {editingClient ? 'Editar Cliente' : 'Cadastrar Cliente'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Preencha os dados do cliente e configure a sua ficha personalizada diretamente.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsClientModalOpen(false);
                  setEditingClient(null);
                  setNewClientName('');
                  setNewClientPhone('');
                  setNewClientEmail('');
                  setModalCustomFields({});
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              
              {/* Informações Básicas */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">Informações Cadastrais</span>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: João da Silva..."
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Telefone (DDD + Número)</label>
                    <input
                      type="text"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Ex: 11999999999"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 font-mono focus:ring-1 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">E-mail (Opcional)</label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      placeholder="Ex: joao@email.com"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Ficha Personalizada (Inputs Dinâmicos) */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Campos da Ficha</span>
                  
                  {!showAddNewFieldInput && (
                    <button
                      type="button"
                      onClick={() => setShowAddNewFieldInput(true)}
                      className="text-[10px] text-purple-400 hover:text-purple-300 font-bold bg-transparent border-0 cursor-pointer hover:underline flex items-center gap-0.5"
                    >
                      + Novo Campo
                    </button>
                  )}
                </div>

                {/* Input rápido para criar um campo de forma dinâmica */}
                {showAddNewFieldInput && (
                  <div className="bg-black/30 p-3 rounded-2xl border border-purple-500/20 flex gap-2 items-center animate-in slide-in-from-top-2 duration-200">
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="Nome do campo (ex: Idade, Peso...)"
                      className="flex-1 px-3 py-2 bg-black/50 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddLocalCustomField}
                      className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-xs cursor-pointer border-0"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddNewFieldInput(false); setNewFieldName(''); }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl cursor-pointer border-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Listagem dos Inputs Personalizados no Modal */}
                {localCustomFieldsDef.length === 0 ? (
                  <p className="text-[10px] text-gray-500 italic p-3 bg-black/10 rounded-xl text-center">
                    Nenhum campo personalizado cadastrado na ficha do cliente ainda. Crie um campo acima!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {localCustomFieldsDef.map((fieldName) => (
                      <div key={fieldName} className="space-y-1 relative group bg-black/10 border border-white/5 p-3 rounded-2xl">
                        <div className="flex justify-between items-center pr-6">
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{fieldName}</label>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocalCustomField(fieldName)}
                            className="absolute right-2 top-2 text-gray-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 bg-transparent border-0 cursor-pointer"
                            title="Remover campo da ficha"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={modalCustomFields[fieldName] || ''}
                          onChange={(e) => {
                            setModalCustomFields({
                              ...modalCustomFields,
                              [fieldName]: e.target.value
                            });
                          }}
                          placeholder={`Preencher ${fieldName.toLowerCase()}...`}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-700 focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botões do Formulário */}
              <div className="flex gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsClientModalOpen(false);
                    setEditingClient(null);
                    setNewClientName('');
                    setNewClientPhone('');
                    setNewClientEmail('');
                    setModalCustomFields({});
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Cliente */}
      {deleteClientConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Cliente</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir o cliente <strong>{deleteClientConfirm.client?.name}</strong>?
                Ele será ocultado da lista do CRM, mas os agendamentos existentes na agenda continuarão salvos.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteClientConfirm({ isOpen: false, client: null })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteClient(deleteClientConfirm.client)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição de Pet */}
      {isPetModalOpen && (
        <div 
          onClick={() => {
            setIsPetModalOpen(false);
            setEditingPet(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <PawPrint className="text-purple-400" size={18} />
                  {editingPet ? 'Editar Pet' : 'Cadastrar Pet'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Insira as informações do animal para vincular a este tutor.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPetModalOpen(false);
                  setEditingPet(null);
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePet} className="space-y-4">
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Nome do Pet</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="Ex: Rex, Mel, Pipoca..."
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500 animate-in fade-in"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Espécie</label>
                    <select
                      value={petType}
                      onChange={(e) => setPetType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value="dog">🐶 Cão</option>
                      <option value="cat">🐱 Gato</option>
                      <option value="bird">🦜 Ave</option>
                      <option value="other">🐾 Outro</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Raça</label>
                    <input
                      type="text"
                      value={petBreed}
                      onChange={(e) => setPetBreed(e.target.value)}
                      placeholder="Ex: Golden, Poodle..."
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Idade / Nascimento</label>
                    <input
                      type="text"
                      value={petAge}
                      onChange={(e) => setPetAge(e.target.value)}
                      placeholder="Ex: 2 anos, 12/04/2021"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Peso (kg)</label>
                    <input
                      type="text"
                      value={petWeight}
                      onChange={(e) => setPetWeight(e.target.value)}
                      placeholder="Ex: 12.5"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Prontuário Clínico / Obs</label>
                  <textarea
                    value={petNotes}
                    onChange={(e) => setPetNotes(e.target.value)}
                    placeholder="Histórico clínico, vacinas, alergias, recomendações especiais..."
                    rows={4}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsPetModalOpen(false);
                    setEditingPet(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPet}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingPet ? 'Salvar Alterações' : 'Adicionar Pet'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Pet */}
      {deletePetConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Pet</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir as informações deste pet?
                Esta ação é definitiva e apagará o prontuário deste animal.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletePetConfirm({ isOpen: false, petId: '' })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeletePet(deletePetConfirm.petId)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição de Veículo */}
      {isVehicleModalOpen && (
        <div 
          onClick={() => {
            setIsVehicleModalOpen(false);
            setEditingVehicle(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full bg-[#0b0c10] border border-white/10 rounded-[2rem] p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto custom-scrollbar"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Car className="text-purple-400" size={18} />
                  {editingVehicle ? 'Editar Veículo' : 'Cadastrar Veículo'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Insira as informações do veículo para vincular a este cliente.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsVehicleModalOpen(false);
                  setEditingVehicle(null);
                }}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all cursor-pointer border-0"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Marca / Modelo</label>
                  <input
                    type="text"
                    value={vehicleBrandModel}
                    onChange={(e) => setVehicleBrandModel(e.target.value)}
                    placeholder="Ex: Honda Civic, Toyota Corolla..."
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Placa</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder="Ex: ABC1D23, ABC-1234"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500 animate-in fade-in"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Ano</label>
                    <input
                      type="text"
                      value={vehicleYear}
                      onChange={(e) => setVehicleYear(e.target.value)}
                      placeholder="Ex: 2021"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Cor</label>
                    <input
                      type="text"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      placeholder="Ex: Preto, Prata, Branco..."
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Quilometragem (KM)</label>
                    <input
                      type="text"
                      value={vehicleKm}
                      onChange={(e) => setVehicleKm(e.target.value)}
                      placeholder="Ex: 85.000"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Histórico / Observações</label>
                  <textarea
                    value={vehicleNotes}
                    onChange={(e) => setVehicleNotes(e.target.value)}
                    placeholder="Histórico de revisões, troca de óleo, desgastes, serviços recomendados..."
                    rows={4}
                    className="w-full px-4 py-2.5 bg-black/40 border border-white/10 focus:border-purple-500 text-white rounded-xl text-xs outline-none transition-all placeholder-gray-600 focus:ring-1 focus:ring-purple-500 resize-none animate-in fade-in"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsVehicleModalOpen(false);
                    setEditingVehicle(null);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingVehicle}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-600/40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 cursor-pointer border-0"
                >
                  <Check size={14} />
                  {editingVehicle ? 'Salvar Alterações' : 'Adicionar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Veículo */}
      {deleteVehicleConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0c10] border border-white/10 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-white">Excluir Veículo</h3>
              <p className="text-xs text-gray-400">
                Tem certeza que deseja excluir as informações deste veículo?
                Esta ação é definitiva e apagará o histórico deste veículo.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteVehicleConfirm({ isOpen: false, vehicleId: '' })}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeDeleteVehicle(deleteVehicleConfirm.vehicleId)}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
