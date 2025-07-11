

# 🤖 Hashkey EqualHub AutoBot

An advanced testnet automation bot designed for the [Hashkey Chain](https://testnet.hsk.xyz/). This bot claims faucet tokens and performs randomized USDT/USDC swaps automatically using multiple wallets and configurable logic.

> 🔗 GitHub: [qlwino/hashkey-equalhub-AutoBot](https://github.com/qlwino/hashkey-equalhub-AutoBot)

---

## 🚀 Features

- 🧠 Multi-wallet support with `.env` credentials
- 💧 Automatic faucet claiming per wallet
- 🔄 Randomized USDT/USDC swaps via StableSwap contract
- 🔁 Daily automation loop with countdown timer
- 💬 Clean user prompts and logs

---

## ⚙️ Requirements

- Node.js `v18+`
- `.env` file with private keys

---

## 📦 Installation

```bash
git clone https://github.com/qlwino/hashkey-equalhub-AutoBot.git
cd hashkey-equalhub-AutoBot
npm install
````

---

## 🔐 .env Setup

Create a `.env` file in the root folder and add your testnet private keys:

```env
PRIVATE_KEY_1=your_wallet_private_key
PRIVATE_KEY_2=another_wallet_key
# Add more if needed

```

## ▶️ How to Run

Start the bot with:

```bash
npm start
```

You will be prompted to enter the number of **daily swap transactions per wallet**.


---


## 📜 License

MIT License — Free to use and adapt with attribution.

---

## 👤 Author

Built by [qlwino](https://github.com/qlwino)

````


