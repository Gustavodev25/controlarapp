import {
    ArrowRightLeft,
    Baby,
    BookOpen,
    Car,
    Cat,
    Clapperboard,
    Coffee,
    DollarSign,
    Dumbbell,
    Fuel,
    Gamepad2,
    Gift,
    GraduationCap,
    Heart,
    Home,
    Landmark,
    Music,
    Plane,
    Settings,
    Shirt,
    ShoppingBag,
    ShoppingCart,
    Smartphone,
    Stethoscope,
    Utensils,
    Wifi,
    Zap
} from 'lucide-react-native';

export const getCategoryConfig = (category?: string) => {
    const cat = category?.toLowerCase() || '';

    const colors = {
        transport: '#FF9F0A',
        food: '#FF453A',
        shopping: '#30D158',
        health: '#64D2FF',
        bills: '#FFD60A',
        home: '#AC8E68',
        entertainment: '#FF375F',
        tech: '#0A84FF',
        income: '#32D74B',
        gray: '#8E8E93',
        finance: '#A2845E'
    };

    const getBg = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        const r = result ? parseInt(result[1], 16) : 128;
        const g = result ? parseInt(result[2], 16) : 128;
        const b = result ? parseInt(result[3], 16) : 128;
        return `rgba(${r}, ${g}, ${b}, 0.15)`;
    };

    let icon = ShoppingBag;
    let color = colors.gray;

    // System Defaults
    if (cat.includes('assinatura')) { icon = Clapperboard; color = colors.entertainment; }
    else if (cat.includes('lembrete')) { icon = ShoppingBag; color = colors.gray; }

    // Transport
    else if (cat.includes('uber') || cat.includes('99') || cat.includes('transport') || cat.includes('taxi') || cat.includes('cab')) { icon = Car; color = colors.transport; }
    else if (cat.includes('fuel') || cat.includes('gas') || cat.includes('posto') || cat.includes('shell') || cat.includes('ipiranga') || cat.includes('combustível')) { icon = Fuel; color = colors.transport; }
    else if (cat.includes('parking') || cat.includes('estacionamento') || cat.includes('park')) { icon = Car; color = colors.transport; }
    else if (cat.includes('auto') || cat.includes('repair') || cat.includes('mecanic') || cat.includes('manuten') || cat.includes('seguro auto')) { icon = Settings; color = colors.transport; }
    else if (cat.includes('bicicleta') || cat.includes('bike')) { icon = Car; color = colors.transport; }
    else if (cat.includes('onibus') || cat.includes('ônibus') || cat.includes('metro') || cat.includes('metrô') || cat.includes('trem') || cat.includes('public')) { icon = Car; color = colors.transport; }
    else if (cat.includes('aluguel carro') || cat.includes('rental')) { icon = Car; color = colors.transport; }

    // Travel
    else if (cat.includes('flight') || cat.includes('airline') || cat.includes('travel') || cat.includes('viagem') || cat.includes('latam') || cat.includes('azul') || cat.includes('passagen')) { icon = Plane; color = colors.tech; }
    else if (cat.includes('hospedagem') || cat.includes('hotel') || cat.includes('airbnb') || cat.includes('accommodation')) { icon = Home; color = colors.tech; }

    // Food
    else if (cat.includes('food') || cat.includes('burger') || cat.includes('ifood') || cat.includes('rappi') || cat.includes('comida') || cat.includes('delivery')) { icon = Utensils; color = colors.food; }
    else if (cat.includes('restaurant') || cat.includes('restaurante') || cat.includes('outback') || cat.includes('madero')) { icon = Utensils; color = colors.food; }
    else if (cat.includes('coffee') || cat.includes('cafe') || cat.includes('starbucks')) { icon = Coffee; color = colors.home; }
    else if (cat.includes('market') || cat.includes('grocer') || cat.includes('supermercado') || cat.includes('mercado') || cat.includes('carrefour') || cat.includes('extra')) { icon = ShoppingCart; color = colors.bills; }

    // Shopping
    else if (cat.includes('shop') || cat.includes('store') || cat.includes('amazon') || cat.includes('mercado livre') || cat.includes('compras') || cat.includes('online')) { icon = ShoppingBag; color = colors.tech; }
    else if (cat.includes('cloth') || cat.includes('apparel') || cat.includes('fashion') || cat.includes('roupa') || cat.includes('vestu')) { icon = Shirt; color = colors.tech; }
    else if (cat.includes('eletron') || cat.includes('tech') || cat.includes('apple') || cat.includes('sams') || cat.includes('eletrônicos')) { icon = Smartphone; color = '#0A84FF'; }

    // Home / Utilities
    else if (cat.includes('home') || cat.includes('house') || cat.includes('casa') || cat.includes('rent') || cat.includes('aluguel') || cat.includes('moradia')) { icon = Home; color = colors.home; }
    else if (cat.includes('internet') || cat.includes('wifi') || cat.includes('vivo') || cat.includes('claro') || cat.includes('tim') || cat.includes('telecom') || cat.includes('celular') || cat.includes('mobile')) { icon = Wifi; color = colors.home; }
    else if (cat.includes('light') || cat.includes('water') || cat.includes('luz') || cat.includes('agua') || cat.includes('água') || cat.includes('energy') || cat.includes('energia') || cat.includes('electricity')) { icon = Zap; color = colors.bills; }

    // Entertainment
    else if (cat.includes('game') || cat.includes('steam') || cat.includes('xbox') || cat.includes('playstation') || cat.includes('nintendo') || cat.includes('jogos') || cat.includes('lazer') || cat.includes('loteria') || cat.includes('aposta')) { icon = Gamepad2; color = colors.entertainment; }
    else if (cat.includes('movie') || cat.includes('film') || cat.includes('cinema') || cat.includes('netflix') || cat.includes('disney') || cat.includes('hbo') || cat.includes('tv') || cat.includes('video') || cat.includes('vídeo')) { icon = Clapperboard; color = colors.entertainment; }
    else if (cat.includes('music') || cat.includes('spotify') || cat.includes('apple music') || cat.includes('show') || cat.includes('música')) { icon = Music; color = colors.entertainment; }

    // Health
    else if (cat.includes('health') || cat.includes('doctor') || cat.includes('med') || cat.includes('hosp') || cat.includes('clinica') || cat.includes('clínica') || cat.includes('saude') || cat.includes('saúde') || cat.includes('exame')) { icon = Heart; color = colors.health; }
    else if (cat.includes('pharmacy') || cat.includes('drug') || cat.includes('farma') || cat.includes('drogasil') || cat.includes('farmácia')) { icon = Stethoscope; color = colors.health; }
    else if (cat.includes('gym') || cat.includes('fit') || cat.includes('sport') || cat.includes('academia') || cat.includes('smart') || cat.includes('bem-estar')) { icon = Dumbbell; color = '#30D158'; }

    // Family / Education
    else if (cat.includes('school') || cat.includes('college') || cat.includes('univ') || cat.includes('educa') || cat.includes('curso') || cat.includes('udemy') || cat.includes('escola')) { icon = GraduationCap; color = '#FF9F0A'; }
    else if (cat.includes('book') || cat.includes('livro') || cat.includes('read')) { icon = BookOpen; color = '#FF9F0A'; }
    else if (cat.includes('pet') || cat.includes('dog') || cat.includes('cat') || cat.includes('vet')) { icon = Cat; color = '#AC8E68'; }
    else if (cat.includes('baby') || cat.includes('kid') || cat.includes('child') || cat.includes('filh')) { icon = Baby; color = '#FFD60A'; }

    // Finance
    else if (cat.includes('transfer') || cat.includes('send') || cat.includes('pix') || cat.includes('boleto')) { icon = ArrowRightLeft; color = colors.gray; }
    else if (cat.includes('bank') || cat.includes('banco') || cat.includes('fee') || cat.includes('taxa') || cat.includes('tax') || cat.includes('imposto') || cat.includes('ir') || cat.includes('juros') || cat.includes('emprestimo') || cat.includes('empréstimo') || cat.includes('divida') || cat.includes('dívida') || cat.includes('card') || cat.includes('cartão') || cat.includes('finança')) { icon = Landmark; color = colors.gray; }
    else if (cat.includes('salary') || cat.includes('income') || cat.includes('salario') || cat.includes('salário') || cat.includes('pagamento') || cat.includes('renda') || cat.includes('beneficio') || cat.includes('benefício') || cat.includes('aposentadoria') || cat.includes('dividend')) { icon = DollarSign; color = colors.income; }
    else if (cat.includes('gift') || cat.includes('present') || cat.includes('doaç')) { icon = Gift; color = '#FF375F'; }

    return { icon, color, backgroundColor: getBg(color) };
};
