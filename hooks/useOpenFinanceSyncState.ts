import { useEffect, useState } from 'react';
import { openFinanceSyncBus, OpenFinanceSyncState } from '@/services/openFinanceSyncBus';

export function useOpenFinanceSyncState(): OpenFinanceSyncState {
    const [state, setState] = useState<OpenFinanceSyncState>(() => openFinanceSyncBus.getState());

    useEffect(() => {
        return openFinanceSyncBus.subscribe(setState);
    }, []);

    return state;
}
