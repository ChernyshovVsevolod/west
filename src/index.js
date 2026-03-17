import Card from './Card.js';
import Game from './Game.js';
import TaskQueue from './TaskQueue.js';
import SpeedRate from './SpeedRate.js';

// Отвечает является ли карта уткой.
function isDuck(card) {
    return card && card instanceof Duck;
}

// Отвечает является ли карта собакой.
function isDog(card) {
    return card && card instanceof Dog;
}

// Дает описание существа по схожести с утками и собаками
function getCreatureDescription(card) {
    if (isDuck(card) && isDog(card)) {
        return 'Утка-Собака';
    }
    if (isDuck(card)) {
        return 'Утка';
    }
    if (isDog(card)) {
        return 'Собака';
    }
    return 'Существо';
}

class Creature extends Card {
    constructor(name, power) {
        super(name, power);
        this._currentPower = power;
    }

    get currentPower() {
        return this._currentPower;
    }

    set currentPower(value) {
        this._currentPower = Math.min(value, this.maxPower);
    }

    getDescriptions() {
        return [getCreatureDescription(this), ...super.getDescriptions()];
    }
}

class Duck extends Creature {
    constructor(name = 'Мирная утка', power = 2) {
        super(name, power);
    }

    quacks() { console.log('quack'); }
    swims() { console.log('float: both;'); }
}

class Dog extends Creature {
    constructor(name = 'Пес-бандит', power = 3) {
        super(name, power);
    }
}

class Trasher extends Dog {
    constructor() {
        super('Громила', 5);
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        this.view.signalAbility(() => {
            super.modifyTakenDamage(value - 1, fromCard, gameContext, continuation);
        });
    }

    getDescriptions() {
        return ['Получает на 1 меньше урона', ...super.getDescriptions()];
    }
}

class Gatling extends Creature {
    constructor() {
        super('Гатлинг', 6);
    }

    attack(gameContext, continuation) {
        const taskQueue = new TaskQueue();
        const {oppositePlayer} = gameContext;

        for (const card of oppositePlayer.table) {
            if (card) {
                taskQueue.push(onDone => {
                    // Проверка: жива ли еще карта на момент выстрела?
                    if (oppositePlayer.table.includes(card)) {
                        this.dealDamageToCreature(2, card, gameContext, onDone);
                    } else {
                        onDone();
                    }
                });
            }
        }

        taskQueue.continueWith(continuation);
    }
}

class Lad extends Dog {
    constructor() {
        super('Браток', 2);
    }

    static getInGameCount() { return this.inGameCount || 0; }
    static setInGameCount(value) { this.inGameCount = value; }

    static getBonus() {
        const count = this.getInGameCount();
        return count * (count + 1) / 2;
    }

    doAfterComingIntoPlay(gameContext, continuation) {
        const count = Lad.getInGameCount();
        Lad.setInGameCount(count + 1);
        continuation();
    }

    doBeforeRemoving(continuation) {
        const count = Lad.getInGameCount();
        Lad.setInGameCount(count - 1);
        continuation();
    }

    modifyDealedDamageToCreature(value, toCard, gameContext, continuation) {
        continuation(value + Lad.getBonus());
    }

    modifyTakenDamage(value, fromCard, gameContext, continuation) {
        continuation(value - Lad.getBonus());
    }

    getDescriptions() {
        if (Lad.prototype.hasOwnProperty('modifyDealedDamageToCreature') || 
            Lad.prototype.hasOwnProperty('modifyTakenDamage')) {
            return ['Чем их больше, тем они сильнее', ...super.getDescriptions()];
        }
        return super.getDescriptions();
    }
}

class Rogue extends Creature {
    constructor() {
        super('Изгой', 2);
    }

    doBeforeAttack(gameContext, continuation) {
        const {oppositePlayer, position} = gameContext;
        const target = oppositePlayer.table[position];

        if (target) {
            const targetProto = Object.getPrototypeOf(target);
            const abilities = ['modifyDealedDamageToCreature', 'modifyDealedDamageToPlayer', 'modifyTakenDamage'];

            abilities.forEach(ability => {
                if (targetProto.hasOwnProperty(ability)) {
                    this[ability] = targetProto[ability];
                    delete targetProto[ability];
                }
            });
        }
        gameContext.updateView();
        continuation();
    }
}

class Brewer extends Duck {
    constructor() {
        super('Пивовар', 2);
    }

    doBeforeAttack(gameContext, continuation) {
        const {currentPlayer, oppositePlayer} = gameContext;
        const allCards = currentPlayer.table.concat(oppositePlayer.table);
        const taskQueue = new TaskQueue();

        allCards.forEach(card => {
            if (isDuck(card)) {
                card.maxPower += 1;
                card.currentPower += 2;
                taskQueue.push(onDone => card.view.signalHeal(() => {
                    card.updateView();
                    onDone();
                }));
            }
        });
        taskQueue.continueWith(continuation);
    }
}

class PseudoDuck extends Dog {
    constructor() {
        super('Псевдоутка', 3);
    }

    quacks() { console.log('quack'); }
    swims() { console.log('float: both;'); }
}

class Nemo extends Creature {
    constructor() {
        super('Немо', 4);
    }

    doBeforeAttack(gameContext, continuation) {
        const {oppositePlayer, position} = gameContext;
        const target = oppositePlayer.table[position];

        if (target) {
            Object.setPrototypeOf(this, Object.getPrototypeOf(target));
            gameContext.updateView();
            if (this.doBeforeAttack !== Nemo.prototype.doBeforeAttack) {
                this.doBeforeAttack(gameContext, continuation);
            } else {
                continuation();
            }
        } else {
            continuation();
        }
    }
}

const seriffStartDeck = [
    new Duck(),
    new Brewer(),
    new Nemo(),
    new Gatling(),
];

// Колода Бандита, верхнего игрока.
const banditStartDeck = [
    new Trasher(),
    new Rogue(),
    new PseudoDuck(),
    new Lad(),
];


// Создание игры.
const game = new Game(seriffStartDeck, banditStartDeck);

// Глобальный объект, позволяющий управлять скоростью всех анимаций.
SpeedRate.set(2);

// Запуск игры.
game.play(false, (winner) => {
    alert('Победил ' + winner.name);
});
