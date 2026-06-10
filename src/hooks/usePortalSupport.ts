import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, deleteField } from 'firebase/firestore';
import { toast } from 'sonner';

export function usePortalSupport(orgId: string | undefined, clientId: string | undefined) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !clientId) return;

    const q = query(
      collection(db, 'organizations', orgId, 'supportRequests'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId, clientId]);

  const createRequest = async (data: { category: string; message: string; priority: string; clientName: string; imageUrl?: string }) => {
    if (!orgId || !clientId) return;

    try {
      await addDoc(collection(db, 'organizations', orgId, 'supportRequests'), {
        ...data,
        clientId,
        status: 'aberto',
        origin: 'portal',
        createdAt: serverTimestamp(),
      });
      toast.success('Chamado aberto com sucesso!');
      return true;
    } catch (error) {
      console.error('Error creating request:', error);
      toast.error('Erro ao abrir chamado.');
      return false;
    }
  };

  const addMessageToRequest = async (requestId: string, newMessage: string, previousReply?: string) => {
    if (!orgId) return;
    
    try {
      const docRef = doc(db, 'organizations', orgId, 'supportRequests', requestId);
      await updateDoc(docRef, {
        message: newMessage,
        status: 'aberto',
        updatedAt: serverTimestamp(),
        // Limpa a resposta do consultor para que o portal mostre "Aguardando resposta..."
        reply: deleteField(),
        repliedAt: deleteField(),
      });
      return true;
    } catch (error) {
      console.error('Error updating request:', error);
      return false;
    }
  };

  return {
    requests,
    loading,
    createRequest,
    addMessageToRequest
  };
}
