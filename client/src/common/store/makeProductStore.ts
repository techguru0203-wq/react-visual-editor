import { create } from 'zustand';

interface MakeProductState {
  roles: string[];
  teammateIds: string[];
  triggerDevPlanGeneration: boolean;
  setMakeProductData: (data: {
    roles: string[];
    teammateIds: string[];
  }) => void;
  clearMakeProductData: () => void;
}

export const useMakeProductStore = create<MakeProductState>((set) => ({
  roles: [],
  teammateIds: [],
  triggerDevPlanGeneration: false,
  setMakeProductData: (data) =>
    set({
      ...data,
      triggerDevPlanGeneration: true,
    }),
  clearMakeProductData: () =>
    set({
      roles: [],
      teammateIds: [],
      triggerDevPlanGeneration: false,
    }),
}));