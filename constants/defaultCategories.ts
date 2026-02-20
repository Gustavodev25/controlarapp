export interface CategoryItem {
    key: string;
    label: string;
    isCustom?: boolean;
}

export interface CategoryGroup {
    title: string;
    items: CategoryItem[];
}

export const DEFAULT_CATEGORIES: CategoryGroup[] = [
    {
        title: 'Viagem',
        items: [
            { key: 'accommodation', label: 'Hospedagem' },
            { key: 'airport and airlines', label: 'Passagens aéreas' },
            { key: 'mileage programs', label: 'Programas de milhas' }
        ]
    },
    {
        title: 'Finanças',
        items: [
            { key: 'account fees', label: 'Tarifas conta' },
            { key: 'income taxes', label: 'IR' },
            { key: 'interests charged', label: 'Juros' },
            { key: 'loans', label: 'Empréstimos' },
            { key: 'taxes', label: 'Impostos' },
            { key: 'credit card', label: 'Cartão de crédito' }
        ]
    },
    {
        title: 'Outros',
        items: [
            { key: 'alimony', label: 'Pensão' },
            { key: 'donation', label: 'Doações' },
            { key: 'gaming', label: 'Lazer' },
            { key: 'vehicle insurance', label: 'Seguro auto' },
            { key: 'digital services', label: 'Serviços digitais' },
            { key: 'benefit programs', label: 'Programas de benefícios' }
        ]
    },
    {
        title: 'Transferências',
        items: [
            { key: 'bank slip', label: 'Boleto' },
            { key: 'credit card payment', label: 'Cartão de crédito' },
            { key: 'debt card', label: 'Cartão débito' },
            { key: 'same person transfer - pix', label: 'Transf. própria Pix' },
            { key: 'transfer - pix', label: 'Transf. Pix' }
        ]
    },
    {
        title: 'Transporte',
        items: [
            { key: 'bicycle', label: 'Bicicleta' },
            { key: 'car rental', label: 'Aluguel carro' },
            { key: 'gas stations', label: 'Combustível' },
            { key: 'parking', label: 'Estacionamento' },
            { key: 'public transportation', label: 'Ônibus / metrô' },
            { key: 'taxi and ride-hailing', label: 'Táxi / apps' },
            { key: 'vehicle maintenance', label: 'Manutenção' }
        ]
    },
    {
        title: 'Entretenimento',
        items: [
            { key: 'cinema, theater and concerts', label: 'Cinema / shows' },
            { key: 'entertainment', label: 'Lazer' },
            { key: 'leisure', label: 'Lazer' },
            { key: 'lottery', label: 'Loterias' },
            { key: 'music streaming', label: 'Streaming música' },
            { key: 'video streaming', label: 'Streaming vídeo' }
        ]
    },
    {
        title: 'Compras',
        items: [
            { key: 'clothing', label: 'Roupas' },
            { key: 'electronics', label: 'Eletrônicos' },
            { key: 'online shopping', label: 'Online' }
        ]
    },
    {
        title: 'Alimentação',
        items: [
            { key: 'eating out', label: 'Restaurante' },
            { key: 'food delivery', label: 'Delivery' },
            { key: 'groceries', label: 'Supermercado' },
            { key: 'n/a', label: 'Outros' }
        ]
    },
    {
        title: 'Moradia',
        items: [
            { key: 'electricity', label: 'Luz' },
            { key: 'rent', label: 'Aluguel' },
            { key: 'water', label: 'Água' }
        ]
    },
    {
        title: 'Renda',
        items: [
            { key: 'fixed income', label: 'Renda fixa' },
            { key: 'government aid', label: 'Benefícios' },
            { key: 'non-recurring income', label: 'Rendimentos extras' },
            { key: 'proceeds interests and dividends', label: 'Juros e dividendos' },
            { key: 'retirement', label: 'Aposentadoria' },
            { key: 'salary', label: 'Salário' },
            { key: 'variable income', label: 'Renda variável' }
        ]
    },
    {
        title: 'Saúde',
        items: [
            { key: 'gyms and fitness centers', label: 'Academia' },
            { key: 'health insurance', label: 'Plano de saúde' },
            { key: 'hospital clinics and labs', label: 'Clínicas / exames' },
            { key: 'pharmacy', label: 'Farmácia' },
            { key: 'wellness', label: 'Bem-estar' }
        ]
    },
    {
        title: 'Telecom',
        items: [
            { key: 'internet', label: 'Internet' },
            { key: 'mobile', label: 'Celular' },
            { key: 'telecommunications', label: 'Telecom' }
        ]
    },
    {
        title: 'Educação',
        items: [
            { key: 'school', label: 'Escola' },
            { key: 'university', label: 'Universidade' }
        ]
    }
];
