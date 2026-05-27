/**
 * Serviço para detectar assinaturas recorrentes nas transações bancárias
 */

export interface DetectedSubscription {
    id: string;
    name: string;
    amount: number;
    frequency: 'monthly' | 'yearly';
    lastDate: string; // ISO Date
    occurrences: number;
    category?: string;
    transactionIds: string[];
    confidence: 'high' | 'medium' | 'low';
}

interface Transaction {
    id: string;
    description: string;
    amount: number;
    date: string; // ISO Date
    type: 'income' | 'expense';
}

/**
 * Normaliza o nome da transação para comparação
 */
const normalizeDescription = (description: string): string => {
    return description
        .toLowerCase()
        .replace(/\d+/g, '') // Remove números
        .replace(/[^\w\s]/g, '') // Remove caracteres especiais
        .trim();
};

/**
 * Calcula a diferença em dias entre duas datas
 */
const daysBetween = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Verifica se duas transações são similares
 */
const areSimilar = (t1: Transaction, t2: Transaction): boolean => {
    // Mesmo tipo (receita ou despesa)
    if (t1.type !== t2.type) return false;

    // Valores próximos (tolerância de 5%)
    const amountDiff = Math.abs(t1.amount - t2.amount);
    const tolerance = Math.max(t1.amount, t2.amount) * 0.05;
    if (amountDiff > tolerance) return false;

    // Descrições similares
    const desc1 = normalizeDescription(t1.description);
    const desc2 = normalizeDescription(t2.description);
    
    // Verifica se uma descrição contém a outra ou se são muito similares
    if (desc1.includes(desc2) || desc2.includes(desc1)) return true;
    
    // Calcula similaridade por palavras
    const words1 = desc1.split(/\s+/);
    const words2 = desc2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w) && w.length > 2);
    
    return commonWords.length >= Math.min(words1.length, words2.length) * 0.6;
};

/**
 * Detecta se um grupo de transações é mensal ou anual
 */
const detectFrequency = (dates: string[]): 'monthly' | 'yearly' | null => {
    if (dates.length < 2) return null;

    const sortedDates = [...dates].sort();
    const intervals: number[] = [];

    for (let i = 1; i < sortedDates.length; i++) {
        const days = daysBetween(sortedDates[i - 1], sortedDates[i]);
        intervals.push(days);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Mensal: entre 25 e 35 dias (tolerância para meses diferentes)
    if (avgInterval >= 25 && avgInterval <= 35) {
        return 'monthly';
    }

    // Anual: entre 350 e 380 dias
    if (avgInterval >= 350 && avgInterval <= 380) {
        return 'yearly';
    }

    return null;
};

/**
 * Calcula o nível de confiança da detecção
 */
const calculateConfidence = (
    occurrences: number,
    frequency: 'monthly' | 'yearly' | null,
    amountVariation: number
): 'high' | 'medium' | 'low' => {
    if (!frequency) return 'low';

    // Alta confiança: 3+ ocorrências, frequência clara, pouca variação no valor
    if (occurrences >= 3 && amountVariation < 0.05) {
        return 'high';
    }

    // Média confiança: 2+ ocorrências, frequência detectada
    if (occurrences >= 2 && amountVariation < 0.15) {
        return 'medium';
    }

    return 'low';
};

/**
 * Tenta identificar a categoria baseada no nome
 */
const guessCategory = (description: string): string => {
    const normalized = description.toLowerCase();

    const categories: { [key: string]: string[] } = {
        'Streaming': ['netflix', 'spotify', 'prime', 'disney', 'hbo', 'youtube', 'deezer', 'apple music'],
        'Assinaturas': ['assinatura', 'subscription', 'mensalidade'],
        'Serviços': ['internet', 'telefone', 'celular', 'energia', 'agua', 'gas'],
        'Saúde': ['academia', 'gym', 'plano de saude', 'seguro saude'],
        'Educação': ['curso', 'escola', 'faculdade', 'universidade'],
        'Transporte': ['uber', 'cabify', '99', 'estacionamento'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => normalized.includes(keyword))) {
            return category;
        }
    }

    return 'Outros';
};

/**
 * Detecta assinaturas recorrentes nas transações
 */
export const detectSubscriptions = (transactions: Transaction[]): DetectedSubscription[] => {
    // Filtra apenas despesas
    const expenses = transactions.filter(t => t.type === 'expense');

    // Agrupa transações similares
    const groups: Transaction[][] = [];

    for (const transaction of expenses) {
        let foundGroup = false;

        for (const group of groups) {
            if (areSimilar(transaction, group[0])) {
                group.push(transaction);
                foundGroup = true;
                break;
            }
        }

        if (!foundGroup) {
            groups.push([transaction]);
        }
    }

    // Filtra grupos com pelo menos 2 ocorrências
    const potentialSubscriptions = groups.filter(g => g.length >= 2);

    // Converte grupos em DetectedSubscription
    const detected: DetectedSubscription[] = [];

    for (const group of potentialSubscriptions) {
        const dates = group.map(t => t.date);
        const frequency = detectFrequency(dates);

        if (!frequency) continue; // Ignora se não detectou frequência

        // Calcula variação no valor
        const amounts = group.map(t => t.amount);
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const maxVariation = Math.max(...amounts.map(a => Math.abs(a - avgAmount) / avgAmount));

        const confidence = calculateConfidence(group.length, frequency, maxVariation);

        // Usa a transação mais recente como referência
        const sortedGroup = [...group].sort((a, b) => b.date.localeCompare(a.date));
        const latest = sortedGroup[0];

        detected.push({
            id: `detected_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: latest.description,
            amount: avgAmount,
            frequency,
            lastDate: latest.date,
            occurrences: group.length,
            category: guessCategory(latest.description),
            transactionIds: group.map(t => t.id),
            confidence
        });
    }

    // Ordena por confiança e número de ocorrências
    return detected.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        if (confDiff !== 0) return confDiff;
        return b.occurrences - a.occurrences;
    });
};

/**
 * Formata uma assinatura detectada para salvar no banco
 */
export const formatDetectedSubscription = (detected: DetectedSubscription) => {
    // Calcula a próxima data de vencimento
    const lastDate = new Date(detected.lastDate);
    const nextDate = new Date(lastDate);

    if (detected.frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    const year = nextDate.getFullYear();
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const day = String(nextDate.getDate()).padStart(2, '0');

    return {
        name: detected.name,
        amount: detected.amount,
        dueDate: `${year}-${month}-${day}`,
        type: 'subscription' as const,
        status: 'pending' as const,
        frequency: detected.frequency,
        category: detected.category,
        transactionType: 'expense' as const,
        detectedFrom: 'bank_transactions',
        transactionIds: detected.transactionIds,
        isValidated: true // Marca como validada quando o usuário confirma
    };
};
