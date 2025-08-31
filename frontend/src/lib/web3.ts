import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { filecoinCalibration } from 'wagmi/chains';

// For now, let's use the default configuration without custom Filecoin chains
// to avoid TypeScript issues. We can add Filecoin support later.
export const config = getDefaultConfig({
  appName: 'FileScope AI',
  projectId: 'c4f79cc821944d9680842e34466bfbd9', // Development project ID
  chains: [
    filecoinCalibration,
  ],
}); 