import { ReactElement } from 'react';

type ModelGroupProps = {
  children: ReactElement | ReactElement[];
};

export const ModelGroup = ({ children }: ModelGroupProps) => {
  return <group>{children}</group>;
};
