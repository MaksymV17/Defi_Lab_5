import { network } from "hardhat";
import { deployAll } from "./lib/deploy.js";

const { ethers } = await network.create();
const fmt = (v) => ethers.formatUnits(v, 18);

const [, user] = await ethers.getSigners();
const { coin, engine, name } = await deployAll(ethers);
const userEngine = engine.connect(user);
const price = await engine.ethPriceUsd();

console.log(`=== Сценарій для ${name}, ціна ETH = $${fmt(price)} ===\n`);

// a) Користувач кладе 2 ETH
await (await userEngine.depositCollateral({ value: ethers.parseEther("2") })).wait();
console.log(`1) Депозит: ${fmt(await engine.collateralOf(user.address))} ETH ` +
            `(вартість $${fmt(await engine.getCollateralValueUsd(user.address))})`);

// b) Програмно підбираємо максимальну суму: бінарний пошук за допомогою staticCall
//    (верхня межа - вартість застави; шукаємо найбільше значення, яке не ревертиться)
let lo = 0n;
let hi = await engine.getCollateralValueUsd(user.address);
while (lo < hi) {
  const mid = (lo + hi + 1n) / 2n;
  try {
    await userEngine.mintStablecoin.staticCall(mid);
    lo = mid; // пройшло -> пробуємо більше
  } catch {
    hi = mid - 1n; // не пройшло -> менше
  }
}
const maxAmount = lo;
await (await userEngine.mintStablecoin(maxAmount)).wait();

console.log(`2) Випущено максимум: ${fmt(maxAmount)} ${name}`);
console.log(`   Контракт каже, що ще доступно: ${fmt(await engine.getMaxMintable(user.address))}`);
console.log(`   Health factor: ${fmt(await engine.healthFactor(user.address))}`);

// c) Спроба зняти 1 ETH -> має бути revert
const ethBefore = await engine.collateralOf(user.address);
console.log("\n3) Спроба зняти 1 ETH застави...");
try {
  await userEngine.withdrawCollateral(ethers.parseEther("1"));
  console.log("ПОМИЛКА: транзакція пройшла, захист НЕ спрацював!");
  process.exitCode = 1;
} catch (err) {
  let reason = err.shortMessage ?? err.message;
  try {
    const parsed = engine.interface.parseError(err.data);
    if (parsed) reason = `${parsed.name}(${parsed.args.join(", ")})`;
  } catch { /* лишаємо загальне повідомлення */ }

  console.log(`Транзакцію відхилено: ${reason}`);
  console.log("Захист спрацював успішно: застава не може бути знята, поки це зробить позицію неліквідною.");
}

const ethAfter = await engine.collateralOf(user.address);
console.log(`\nЗастава до/після спроби: ${fmt(ethBefore)} / ${fmt(ethAfter)} ETH (без змін: ${ethBefore === ethAfter})`);

// Бонус: погашаємо борг і знімаємо ETH - тепер це дозволено
const half = maxAmount / 2n;
await (await coin.connect(user).approve(await engine.getAddress(), half)).wait();
await (await userEngine.burnStablecoin(half)).wait();
await (await userEngine.withdrawCollateral(ethers.parseEther("1"))).wait();
console.log(`\nБонус: після burn ${fmt(half)} ${name} зняття 1 ETH пройшло. ` +
            `Борг: ${fmt(await engine.debtOf(user.address))}, застава: ${fmt(await engine.collateralOf(user.address))} ETH`);
