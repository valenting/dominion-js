"use strict";

// Necessary for shuffling hands
Array.prototype.shuffle = function() {
  let m = this.length, t, i;

  // While there remain elements to shuffle…
  while (m) {

    // Pick a remaining element…
    i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    t = this[m];
    this[m] = this[i];
    this[i] = t;
  }
}

function generateN(cardType, count) {
  let array = [];
  while (count--) {
    array.push(new cardType());
  }
  return array;
}

Array.prototype.pretty = function() {
  let text = "";
  if (this.length > 0 && typeof this[0].cost === "function") {
    text = `[${this.map(c => c.name())}]`;
  } else {
    text = JSON.stringify(this);
  }

  return text;
}

function stringOption(opt) {
  if (typeof opt == "string") {
    return opt;
  }
  if (typeof opt.cost == "function") {
    return opt.name();
  }
  return opt;
}

class Game {
  constructor() {
    this._players = []; // Array<Player>
    this._trash = []; // Array<Card>
    this._supply = {}; // Map<CardType, Array<Card>>
    this._seed = "";

    this._state = null;
    this._activePlayer = null;
    this._activeChoice = null;
  }

  async addPlayer(name) {
    this._players.push(new Player(name));
  }

  async choose(player, options, minChoices, maxChoices) {
    if (options.length == 0) {
      return [];
    }

    let text = options.map((c, index) => ` ${index} : ${stringOption(c)}`);
    console.log(`${player._name} choose: ${text}`);

    if (options.length <= minChoices) {
      console.log(`${player._name} chose options: ${options.pretty()}`);
      return options;
    }
    let option = await new Promise(resolve => {
      this._activeChoice = {
        player,
        minChoices,
        maxChoices,
        options,
        resolve,
      };
    });
    this._activeChoice = null;

    return option;
  }

  async decideOption(choices) {
    let choice = this._activeChoice;
    if (!choice) {
      throw "No choice to be made";
    }

    for (let index of choices) {
      if (typeof index !== "number") {
        throw `Choice ${index} is not a number`;
      }
      let text = choice.options.map((c, index) => ` ${index} : ${stringOption(c)}`);
      if (index < 0 || index >= choice.options.length) {
         throw `Bad choice index=${index}. Choices: ${text}`;
      }
    }

    let unique = [...new Set(choices)];
    if (choice.maxChoices != undefined && unique.length > choice.maxChoices) {
      throw `Too many choices`;
    }

    if (choice.minChoices != undefined && unique.length < choice.minChoices) {
      throw `Too few choices`;
    }
    console.log(`${choice.player._name} chose options: ${unique}`);

    let results = [];
    for (let o of unique) {
      results.push(choice.options[o]);
    }
    choice.resolve(results);
  }

  async setup(kingdomCards) {
    if (this._players.length < 2) {
      throw "Not enough players";
    }
    let victoryCount = this._players.length > 2 ? 12 : 8;
    this._supply["Estate"] = generateN(Estate, victoryCount);
    this._supply["Duchy"] = generateN(Duchy, victoryCount);
    this._supply["Province"] = generateN(Province, victoryCount);

    this._supply["Copper"] = generateN(Copper, 60 - this._players.length*7);
    this._supply["Silver"] = generateN(Silver, 40);
    this._supply["Gold"] = generateN(Gold, 30);

    this._supply["Curse"] = generateN(Curse, (this._players.length - 1)*10);

    // Add kingdom cards
    if (!kingdomCards) {
      kingdomCards = [Cellar, Market, Merchant, Militia, Mine, Moat, Remodel, Smithy, Village, Workshop];
    }

    for (let k of kingdomCards) {
      this._supply[k.name] = generateN(k, 10);
    }

    this._players.shuffle();
  }

  async start() {
    await this.setup();
    while (!await this.isFinished()) {
      for (let p of this._players) {
        this._activePlayer = p;
        await this.playRound();
        if (await this.isFinished()) {
          break;
        }
      }
    }
    console.log("Game is finished");

    console.log(await this.countPoints());
  }

  async countPoints() {
    let finalCount = {};
    for (let p of this._players) {
      finalCount[p._name] = await p.countPoints();
    }
    return finalCount;
  }

  async cardsCostingAtMost(count) {
    let cardNames = [];
    for (let name in this._supply) {
      if (this._supply[name].length > 0 && this._supply[name][0].cost() <= count) {
        cardNames.push(name);
      }
    }
    return cardNames;
  }

  async playRound() {
    let player = this._activePlayer;
    console.log(`${player._name} is starting action phase`);
    // Action phase
    player._actions = 1;
    while (player._actions > 0) {
      let actionCardsInHand = await player.actionCardsInHand();
      console.log(`${player._name} has ${player._actions} actions and ${actionCardsInHand.pretty()} in hand`);
      if (actionCardsInHand.length == 0) {
        break;
      }
      let choice = await this.choose(player, actionCardsInHand, 0, 1);
      if (choice.length == 0) {
        break;
      }

      let actionCard = actionCardsInHand[0];
      player._actions--;
      await actionCard.play(player, this);
    }
    console.log(`${player._name} is starting buy phase`);
    // Buy phase
    player._actions = 0;
    player._buys++;
    player._coins += await player.coinValueOfCardsInPlay();
    player._coins += player._merchant_cards_played.length * player._hand.filter(c => c.name() == "Silver").length;
    player._merchant_cards_played = [];
    while (player._buys > 0) {
      console.log(`${player._name} has ${player._buys} buys and ${player._coins} coins`);
      let choices = await this.cardsCostingAtMost(player._coins);
      let choice = await this.choose(player, choices, 0, 1);
      if (choice.length == 0) {
        break;
      }
      let cardName = choice[0];
      let card = this._supply[cardName].shift();
      player._buys--;
      player._coins -= card.cost();
      console.log(`${player._name} gained ${card.name()}`);
      // card.onGained()
      player._discard.push(card);
    }

    console.log(`${player._name} is doing cleanup`);
    // Cleanup phase
    player._actions = 0;
    player._buys = 0;
    player._coins = 0;
    await player.discardDeck();
  }

  async isFinished() {
    if (this._supply["Province"].length == 0) {
      return true;
    }

    if ((await this.emptyPiles()).length >= 3) {
      return true;
    }

    return false;
  }

  async attack(attacker, target, attack) {
    if (target) {
      return target.onAttack(attacker, attack, this);
    }

    for (let other of this._players) {
      if (other == attacker) {
        continue;
      }
      await other.onAttack(attacker, attack, this);
    }
  }

  // Returns Array<CardName: String>
  async emptyPiles() {
    return Object.entries(this._supply).filter( ([k,v]) => v.length == 0).map( ([k, v]) => k);
  }
};

class Player {
  constructor(name) {
    if (!name) {
      throw "Empty player name";
    }
    this._name = name; // String

    let cards = generateN(Copper, 7).concat(generateN(Estate, 3));
    cards.shuffle();

    this._deck = cards.slice(0,5); // Array<Card>
    this._hand = cards.slice(5, 10); // Array<Card>
    this._played = []; // Array<Card>
    this._discard = []; // Array<Card>
    this._coins = 0;
    this._buys = 0;
    this._actions = 0;

    this._merchant_cards_played = [];
  }

  async countPoints() {
    let points = 0;
    for (let card of this._deck.concat(this._hand).concat(this._discard).filter(c => c.type().includes("victory"))) {
      points += card.value(this, /* TODO: game */ null);
    }

    return points;
  }

  async hasActionCards() {
    return (await this.actionCardsInHand()).length > 0;
  }

  async actionCardsInHand() {
    return this._hand.filter(c => c.type().includes("action"));
  }

  async coinValueOfCardsInPlay() {
    let treasureCardsInPlay = this._hand.filter(c => c.type().includes("treasure"));
    let coins = treasureCardsInPlay.reduce((acc, card) => acc + card.value(), 0);
    return coins;
  }

  async discardDeck() {
    // onDiscard ?
    let cards = this._hand.concat(this._played);
    console.log(`${this._name} discarded ${cards.pretty()}`);
    this._discard = this._discard.concat(cards);
    this._played = [];
    this._hand = await this.drawCards(5);
    console.log(`${this._name} drew ${this._hand.pretty()}`);
  }

  async drawCards(count) {
    if (count===undefined) {
      throw "Unspecified number of cards";
    }
    let cards = [];
    while (count--) {
      if (!this._deck.length) {
        if (!this._discard.length) {
          break;
        }
        this._discard.shuffle();
        this._deck = this._discard;
        this._discard = [];
      }
      let card = this._deck.pop();
      cards.push(card);
    }
    return cards;
  }

  async putInHand(cards) {
    this._hand = this._hand.concat(cards);
  }

  async onAttack(attacker, attack, game) {

    let reactions = this._hand.filter(c => c.type().includes("reaction"));
    let [choice] = await game.choose(this, reactions, 0, 1);
    if (choice) {
      return choice.onAttack(attacker, this, attack);
    }

    await attack(this, attacker);
  }
}

// card.js

class Card {
  name() {
    return this.constructor.name;
  }

  value() {
    return this.__proto__._value;
  }

  type() {
    return this.__proto__._type;
  }

  cost() {
    return this.__proto__._cost;
  }

  async play(player, game) {
    if (!player) {
      throw "No player";
    }
    if (!game) {
      throw "No game";
    }

    console.log(`Player ${player._name} played ${this.name()} card`);

    player._hand = player._hand.filter( card => card != this);
    player._played.push(this);
  }
}

class Copper extends Card {
}
Copper.prototype._value = 1;
Copper.prototype._type = ["treasure"];
Copper.prototype._cost = 0;

class Silver extends Card {
}
Silver.prototype._value = 2;
Silver.prototype._type = ["treasure"];
Silver.prototype._cost = 3;

class Gold extends Card {
}
Gold.prototype._value = 3;
Gold.prototype._type = ["treasure"];
Gold.prototype._cost = 6;

class Estate extends Card {
}
Estate.prototype._value = 1;
Estate.prototype._type = ["victory"];
Estate.prototype._cost = 2;

class Duchy extends Card {
}
Duchy.prototype._value = 3;
Duchy.prototype._type = ["victory"];
Duchy.prototype._cost = 5;

class Province extends Card {
}
Province.prototype._value = 6;
Province.prototype._type = ["victory"];
Province.prototype._cost = 6;

class Curse extends Card {
}
Curse.prototype._value = -1;
Curse.prototype._type = ["curse"];
Curse.prototype._cost = 0;

class Cellar extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Action.
    // Discard any number of cards. +1 Card per card discarded.

    player._actions += 1;
    let choices = player._hand;
    let choice = await game.choose(player, choices, 0);

    for (let card of choice) {
      player._hand = player._hand.filter(c => c != card);
      player._discard.push(card);
    }

    await player.putInHand(await player.drawCards(choice.length));
  }
}

Cellar.prototype._value = 0;
Cellar.prototype._type = ["action"];
Cellar.prototype._cost = 2;

class Chapel extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Trash up to 4 cards from your hand.

    let choices = player._hand;
    let choice = await game.choose(player, choices, 0, 4);

    for (let card of choice) {
      player._hand = player._hand.filter(c => !Object.is(c,card));
      game._trash.push(card);
    }
  }
}

Chapel.prototype._value = 0;
Chapel.prototype._type = ["action"];
Chapel.prototype._cost = 2;

class Moat extends Card {
  async play(player, game) {
    await super.play(player, game);
    await player.putInHand(await player.drawCards(2));
  }

  async onAttack(attacker, target, attack) {
    // When another player plays an Attack card,
    // you may reveal this from your hand.
    // If you do, you are unaffected by that Attack.

    console.log(`${target._name} reveals Moat and avoids attack`);
  }
}

Moat.prototype._value = 0;
Moat.prototype._type = ["action", "reaction"];
Moat.prototype._cost = 2;

class Harbinger extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card
    // +1 Action
    // Look through your discard pile.
    // You may put a card from it onto your deck.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;

    let choices = player._discard;
    let [card] = await game.choose(player, choices, 0, 1);
    if (!card) {
      return;
    }
    player._discard = player._discard.filter(c => c != card);
    player._deck.push(card);
  }
}

Harbinger.prototype._value = 0;
Harbinger.prototype._type = ["action"];
Harbinger.prototype._cost = 3;

class Merchant extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card. +1 Action.
    // The first time you play a Silver this turn, +$1.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;

    // We need this in case a Throne room is played with Merchant.
    player._merchant_cards_played.push(this);
  }
}

Merchant.prototype._value = 0;
Merchant.prototype._type = ["action"];
Merchant.prototype._cost = 3;

class Vassal extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +$2.
    // Discard the top card of your deck.
    // If it is an Action card, you may play it.

    player._coins += 2;
    let [topCard] = await player.drawCards(1);
    if (topCard && topCard.type().includes("action")) {
      console.log(`Do you want to play ${topCard.name()}?`);
      let [choice] = await game.choose(player, ["no", "yes"], 1, 1);
      if (choice == "yes") {
        topCard.play(player, game);
      }
    }
    if (topCard) {
      player._discard.push(topCard);
    }
  }
}

Vassal.prototype._value = 0;
Vassal.prototype._type = ["action"];
Vassal.prototype._cost = 3;


class Village extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card. +2 Actions.
    await player.putInHand(await player.drawCards(1));
    player._actions += 2;
  }
}

Village.prototype._value = 0;
Village.prototype._type = ["action"];
Village.prototype._cost = 3;

class Workshop extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Gain a card costing up to $4.
    let [cardName] = await game.choose(player, await game.cardsCostingAtMost(4), 1,1);
    let card = this._supply[cardName].shift();
    player._discard.push(card);
  }
}

Workshop.prototype._value = 0;
Workshop.prototype._type = ["action"];
Workshop.prototype._cost = 3;

class Bureaucrat extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Gain a Silver card; put it on top of your deck.
    // Each other player reveals a Victory card from his hand
    // and puts it on his deck (or reveals a hand with no Victory cards).
    let card = game._supply["Silver"].shift();
    player._deck.push(card);

    let attack = async (target, attacker) => {
      let victoryCards = target._hand.filter(card => card.type().includes("victory"));
      console.log(victoryCards);
      let [c2] = await game.choose(target, victoryCards, 1, 1);
      if (c2) {
        target._hand = target._hand.filter(c => c != c2);
        console.log(`${target._name} putting ${c2.name()} back in deck`);
        target._deck.push(c2);
      } else {
        console.log(`${target._name} revealed ${target._hand.pretty()}`);
      }
    };

    await game.attack(player, null, attack);
  }
}

Bureaucrat.prototype._value = 0.5;
Bureaucrat.prototype._type = ["action", "attack"];
Bureaucrat.prototype._cost = 4;

class Gardens extends Card {
  value(player, game) {
    // Worth 1VP per 10 cards you have (round down).
    let cardCount = player._deck.length + player._hand.length + player._discard.length;
    console.log("gardens value", cardCount, Math.floor(cardCount / 10));
    return Math.floor(cardCount / 10);
  }
}

Gardens.prototype._value = 0;
Gardens.prototype._type = ["victory"];
Gardens.prototype._cost = 4;

class Militia extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +$2.
    // Each other player discards down to 3 cards in his hand.

    player._coins += 2;

    let attack = async (target, attacker) => {
      if (target._hand.length <= 3) {
        console.log(`${target._name} has 3 or less cards in hand`);
        return;
      }
      let discardCount = target._hand.length - 3;
      let choices = await game.choose(target, choices, discardCount, discardCount);
      for (let card in choices) {
        target._hand = target._hand.filter(c => c != card);
        target._discard.push(card);
      }
    };
    await game.attack(player, null, attack);
  }
}

Militia.prototype._value = 0;
Militia.prototype._type = ["action", "attack"];
Militia.prototype._cost = 4;

class Moneylender extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Trash a Copper card from your hand. If you do, +$3.
    let coppers = player._hand.filter(c => c.name() == "Copper");
    if (coppers.length == 0) {
      return;
    }

    console.log(`Do you want to trash a Copper?`);
    let [choice] = await game.choose(player, ["no", "yes"], 1, 1);
    if (choice == "yes") {
      let firstCopper = coppers[0];
      target._hand = target._hand.filter(c => c != firstCopper);
      game._trash.push(firstCopper);
      player._coins += 3;
    }
  }
}

Moneylender.prototype._value = 0;
Moneylender.prototype._type = ["action"];
Moneylender.prototype._cost = 4;


class Poacher extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card.
    // +1 Action.
    // +$1.
    // Discard a card per empty supply pile.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;
    player._coins += 1;

    let count = (await game.emptyPiles()).length;
    if (player._hand.length < count) {
      count = player._hand.length;
    }
    let toDiscard = await game.choose(player, player._hand, count, count);
    for (let card of toDiscard) {
      player._hand = player._hand.filter(c => c != card);
      player._discard.push(card);
    }
  }
}

Poacher.prototype._value = 0;
Poacher.prototype._type = ["action"];
Poacher.prototype._cost = 4;


class Remodel extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Trash a card from your hand.
    // Gain a card costing up to $2 more than the trashed card.

    let choices = player._hand;
    if (choices.length == 0) {
      return;
    }
    let [card] = await game.choose(player, choices, 1, 1);
    player._hand = player._hand.filter(c => c != card);
    game._trash.push(card);

    choices = await game.cardsCostingAtMost(card.cost() + 2);
    let [cardName] = await this.choose(player, choices, 1, 1);
    card = game._supply[cardName].shift();
    player._discard.push(card);
  }
}

Remodel.prototype._value = 0;
Remodel.prototype._type = ["action"];
Remodel.prototype._cost = 4;


class Smithy extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +3 Cards
    await player.putInHand(await player.drawCards(3));
  }
}

Smithy.prototype._value = 0;
Smithy.prototype._type = ["action"];
Smithy.prototype._cost = 4;

class ThroneRoom extends Card {
  async play(player, game) {
    await super.play(player, game);

    // You may play an Action card from your hand twice.

    let choices = player._hand.filter(c => c.type().includes("action"));
    let [card] = await game.choose(player, choices, 0, 1);
    if (card) {
      await card.play(player, game);

      // Move card back into hand and play it again.

      player._played = player._played.filter(c => c != card);
      player._hand.push(card);

      await card.play(player, game);
    }
  }
}

ThroneRoom.prototype._value = 0;
ThroneRoom.prototype._type = ["action"];
ThroneRoom.prototype._cost = 4;

class Bandit extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Gain a Gold.
    // Each other player reveals the top 2 cards of their deck,
    // trashes a revealed Treasure other than Copper, and discards the rest.
    let card = this._supply["Gold"].shift();
    player._discard.push(card);

    let attack = async (target, attacker) => {
      let cards = await target.drawCards(2);
      console.log(`${target._name} revealed ${cards.pretty()}`);
      let options = cards.filter(c => c.type().includes("treasure") && c.name() != "Copper");
      if (options.length > 0) {
        let card = options[0];
        if (options.length == 2) {
          [card] = await game.choose(target, choices, 1, 1);
        }
        cards = cards.filter(c => c != card);
        game._trash.push(card);
      }
      target._discard = target._discard.concat(cards);
    };

    await game.attack(player, null, attack);
  }
}

Bandit.prototype._value = 0;
Bandit.prototype._type = ["action", "attack"];
Bandit.prototype._cost = 5;


class CouncilRoom extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +4 Cards.
    // +1 Buy.
    // Each other player draws a card.

    await player.putInHand(await player.drawCards(4));
    player._buys += 1;

    for (let other in game._players) {
      if (other == player) {
        continue;
      }
      await other.putInHand(await other.drawCards(1));
    }
  }
}

CouncilRoom.prototype._value = 0;
CouncilRoom.prototype._type = ["action"];
CouncilRoom.prototype._cost = 5;


class Festival extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +2 Actions. +1 Buy. +$2.
    player._actions += 2;
    player._buys += 1;
    player._coins += 2;
  }
}

Festival.prototype._value = 0;
Festival.prototype._type = ["action"];
Festival.prototype._cost = 5;


class Laboratory extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +2 Cards. +1 Action.
    await player.putInHand(await player.drawCards(2));
    player._actions += 1;
  }
}

Laboratory.prototype._value = 0;
Laboratory.prototype._type = ["action"];
Laboratory.prototype._cost = 5;


class Library extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Draw until you have 7 cards in hand.
    // You may set aside any Action cards drawn this way, as you draw them;
    // discard the set aside cards after you finish drawing.

    let toDiscard = [];
    while (player._hand.length < 7) {
      let [card] = await player.drawCards(1);
      if (!card) {
        break;
      }
      if (card.type().includes("action")) {
        console.log(`Do you want to discard ${card.name()}?`);
        let [choice] = await game.choose(player, ["no", "yes"], 1, 1);
        if (choice == "yes") {
          toDiscard.push(card);
        } else {
          player._hand.push(card);
        }
      } else {
        player._hand.push(card);
      }
    }
    player._discard = player._discard.concat(toDiscard);
  }
}

Library.prototype._value = 0;
Library.prototype._type = ["action"];
Library.prototype._cost = 5;


class Market extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card. +1 Action. +1 Buy. +$1.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;
    player._buys += 1;
    player._coins += 1;
  }
}

Market.prototype._value = 0;
Market.prototype._type = ["action"];
Market.prototype._cost = 5;



class Mine extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Trash a Treasure card from your hand.
    // Gain a Treasure card costing up to $3 more; put it into your hand.

    let choices = player._hand.filter(c => c.type().includes("treasure"));
    let [card] = await game.choose(player, choices, 1, 1);
    player._hand = player._hand.filter(c => c != card);
    game._trash.push(card);
    choices = await game.cardsCostingAtMost(card.cost() + 3);
    let [cardName] = await game.choose(player, choices, 1, 1);
    card = game._supply[cardName].shift();
    player._hand.push(card);
  }
}

Mine.prototype._value = 0;
Mine.prototype._type = ["action"];
Mine.prototype._cost = 5;

class Sentry extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card. +1 Action.
    // Look at the top 2 cards of your deck.
    // Trash and/or discard any number of them.
    // Put the rest back on top in any order.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;

    let choices = await player.drawCards(2);
    let toTrash = await game.choose(player, choices, 0);
    for (let card of toTrash) {
      choices = choices.filter(c => c != card);
      game._trash.push(card);
    }

    let toDiscard = await game.choose(player, choices, 0);
    for (let card of toDiscard) {
      choices = choices.filter(c => c != card);
      player._discard.push(card);
    }

    let toPutBack = await game.choose(player, choices, choices.length);
    for (let card of toPutBack) {
      choices = choices.filter(c => c != card);
      player._deck.push(card);
    }
  }
}

Sentry.prototype._value = 0;
Sentry.prototype._type = ["action"];
Sentry.prototype._cost = 5;

class Witch extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +2 Cards.
    // Each other player gains a Curse card.

    await player.putInHand(await player.drawCards(2));

    let attack = async (target, attacker) => {
      let curse = game._supply["Curse"].shift();
      if (!curse) {
        return;
      }
      target._discard.push(curse);
    };

    await game.attack(player, null, attack);
  }
}

Witch.prototype._value = 0;
Witch.prototype._type = ["action", "attack"];
Witch.prototype._cost = 5;


class Artisan extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Gain a card to your hand costing up to $5.
    // Put a card from your hand onto your deck.

    let choices = await game.cardsCostingAtMost(5);
    let [cardName] = await game.choose(player, choices, 1, 1);
    let card = game._deck[cardName].shift();
    player._hand.push(card);

    choices = player._hand;
    card = await game.choose(player, choices, 1, 1);

    player._hand = player._hand.filter(c => c != card);
    player._deck.push(card);
  }
}

Artisan.prototype._value = 0;
Artisan.prototype._type = ["action"];
Artisan.prototype._cost = 6;

// Removed cards

class Chancellor extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +$2.
    // You may immediately put your deck into your discard pile.

    player._coins += 2;

    console.log(`${player._name} put deck into discard pile?`);
    let [choice] = await game.choose(player, ["no", "yes"], 1, 1);
    if (choice == "yes") {
      player._discard = player._discard.concat(player._deck);
      player._deck = [];
    }
  }
}

Chancellor.prototype._value = 0;
Chancellor.prototype._type = ["action"];
Chancellor.prototype._cost = 3;


class Woodcutter extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Buy.
    // +$2.

    player._buys += 1;
    player._coins += 2;
  }
}

Woodcutter.prototype._value = 0;
Woodcutter.prototype._type = ["action"];
Woodcutter.prototype._cost = 3;


class Feast extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Trash this card. Gain a card costing up to $5.

    player._played = player._played.filter(c => c != this);
    let choices = await game.cardsCostingAtMost(5);
    let [choice] = await game.choose(player, choices, 1, 1);
    player._discard.push(choice);
  }
}

Feast.prototype._value = 0;
Feast.prototype._type = ["action"];
Feast.prototype._cost = 4;


class Spy extends Card {
  async play(player, game) {
    await super.play(player, game);

    // +1 Card. +1 Action.
    // Each player (including you) reveals the top card of his deck and
    // either discards it or puts it back, your choice.

    await player.putInHand(await player.drawCards(1));
    player._actions += 1;

    let attack = async (target, attacker) => {
      let [card] = await target.drawCards(1);
      if (card) {
        let [choice] = await game.choose(attacker, ["discard", "put back"], 1, 1);
        if (choice == "discard") {
          target._discard.push(card);
        } else {
          target._deck.push(card);
        }
      }
    };

    // Player attacks self. XXX: should this invoke reaction logic?
    await attack(player, player);

    // Attack all other players too.
    await game.attack(player, null, attack);
  }
}

Spy.prototype._value = 0;
Spy.prototype._type = ["action", "attack"];
Spy.prototype._cost = 4;


class Thief extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Each other player reveals the top 2 cards of his deck.
    // If they revealed any Treasure cards, they trash one of them
    // that you choose. You may gain any or all of these trashed cards.
    // They discard the other revealed cards.


    let attack = async (target, attacker) => {
      let cards = await target.drawCards(2);
      let [choice] = await game.choose(attacker, cards.filter(c => c.type().includes("treasure")), 1, 1);
      if (choice) {
        // XXX: in the future card trashing handler will run here
        console.log(`${target._name} trashed ${choice.name()}`);
        game._trash.push(choice);
        console.log(`${attacker._name} do you want to gain it?`);
        let [gain] = await game.choose(attacker, ["yes", "no"], 1, 1);
        if (gain == "yes") {
          card = game._trash.pop();
          attacker._discard.push(card);
        }
      }
      // Discard other cards.
      target._discard = target._discard.concat(cards.filter(c => c != choice));
    };

    await game.attack(player, null, attack);
  }
}

Thief.prototype._value = 0;
Thief.prototype._type = ["action", "attack"];
Thief.prototype._cost = 4;

class Adventurer extends Card {
  async play(player, game) {
    await super.play(player, game);

    // Reveal cards from your deck until you reveal 2 Treasure cards.
    // Put those Treasure cards into your hand and discard the other revealed cards.

    let revealed = [];
    while (revealed.filter(c => c.type().includes("treasure")) < 2) {
      let [card] = await player.drawCards(1);
      if (!card) {
        break;
      }
      revealed.push(card);
    }

    player._hand = player._hand.concat(revealed.filter(c => c.type().includes("treasure")));
    player._discard = player._discard.concat(revealed.filter(c => !c.type().includes("treasure")));
  }
}

Adventurer.prototype._value = 0;
Adventurer.prototype._type = ["action"];
Adventurer.prototype._cost = 6;

// Exports

if (!module) {
  var module = { exports: {}};
}

module.exports.Game = Game;
module.exports.Player = Player;
module.exports.Cards = {
  Copper,
  Silver,
  Gold,

  Estate,
  Duchy,
  Province,

  Curse,
  Cellar,
  Chapel,
  Moat,
  Harbinger,
  Merchant,
  Vassal,
  Village,
  Workshop,
  Bureaucrat,
  Gardens,
  Militia,
  Moneylender,
  Poacher,
  Remodel,
  Smithy,
  ThroneRoom,
  Bandit,
  CouncilRoom,
  Festival,
  Laboratory,
  Library,
  Market,
  Mine,
  Sentry,
  Witch,
  Artisan,

  // Removed
  Chancellor,
  Woodcutter,
  Feast,
  Spy,
  Thief,
  Adventurer,
}