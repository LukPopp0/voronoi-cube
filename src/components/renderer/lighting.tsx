export const Lighting = () => {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight intensity={0.5} position={[1, 1.2, 1]} />
      <directionalLight intensity={0.5} position={[-1, 1.2, 1]} />
      <directionalLight intensity={0.5} position={[0, -1.2, -1]} />
    </>
  );
};
