export const SURNAME = "Vertii";
export const INITIAL_ETH_PRICE_USD = 2000n;

export async function deployAll(ethers) {
  const name = `${SURNAME}USD`;

  const coin = await ethers.deployContract("StableCoin", [name, name]);
  await coin.waitForDeployment();

  const engine = await ethers.deployContract("StableEngine", [
    await coin.getAddress(),
    ethers.parseUnits(INITIAL_ETH_PRICE_USD.toString(), 18),
  ]);
  await engine.waitForDeployment();

  // Лише Engine може mint/burn
  await (await coin.transferOwnership(await engine.getAddress())).wait();

  return { coin, engine, name };
}
