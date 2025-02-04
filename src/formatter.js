const database = require('./database');
const Discord = require('discord.js');
const parser = require('./parser.js');

exports.abbreviate = function(text, length) {
  return text.length > length ? `${text.substring(0, length - 3)}...` : text;
};

exports.updateBill = async function(bill, updateReport, channel) {
  const recentHistoryItem = parser.recentHistory(bill);

  if (database.getConfig('embeds')) {
    if (updateReport.new || updateReport.progress || updateReport.hearing) {
      const embed = new Discord.RichEmbed()
        .setTitle(`${parser.state(bill.state)} ${bill.number} ${updateReport.new ? 'Introduced' : 'Update'}`)
        .setURL(bill.url)
        .setDescription(this.abbreviate(bill.title, 500));

      if (updateReport.progress) {
        embed.addField(`New ${this.date(updateReport.progress.timestamp)} Action`, updateReport.progress.action);
      }

      if (updateReport.hearing) {
        embed.addField(`New ${updateReport.hearing.localDate} ${updateReport.hearing.localTime || ''} ${updateReport.hearing.type}`, updateReport.hearing.description);
      }

      embed.setTimestamp().setFooter(bill.id);

      await channel.send(embed);
    }
  } else {
    if (updateReport.new) {
      await channel.send(`Found new bill **${parser.state(bill.state)} ${bill.number}**: *${parser.title(bill)}* ${recentHistoryItem.action} as of \`${this.date(recentHistoryItem.timestamp)}\` (<${bill.url}>)\n`);
    } else {
      if (updateReport.progress) {
        await channel.send(`Bill **${parser.state(bill.state)} ${bill.number}** changed to ${updateReport.progress.action} as of \`${this.date(updateReport.progress.timestamp)}\``);
      }

      if (updateReport.hearing) {
        await channel.send(
          `${updateReport.hearing.type || 'Hearing'} for bill **${parser.state(bill.state)} ${bill.number}** scheduled for ${updateReport.hearing.localDate} at ${updateReport.hearing.localTime}, which is ${this.duration(updateReport.hearing.timestamp)}. The hearing is described as ${
            updateReport.hearing.description
          }. For more information, visit <${bill.url}>`
        );
      }
    }
  }
};

exports.bills = async function(bills, channel, client) {
  if (database.getConfig('embeds')) {
    let fields = 0;
    let index = 0;
    let page = 1;
    let text = 0;

    while (index < bills.length) {
      const embed = new Discord.RichEmbed().setTitle(`Legislation`).setDescription(`Page ${page}`);

      while (index < bills.length && fields < 5 && text < 4000) {
        const bill = bills[index];
        let billText = `**Title:** ${this.abbreviate(bill.title, 500)}\n`;
        billText += `**Url**: [${bill.id}](${bill.url})\n`;

        if (bill.watching) {
          const recentHistoryItem = parser.recentHistory(bill);
          if (recentHistoryItem) {
            billText += `**Status as of ${this.date(recentHistoryItem.timestamp)}:** ${recentHistoryItem.action}\n`;
          }
          if (bill.calendar) {
            for (const calendarItem of bill.calendar.slice(-2)) {
              billText += `**${calendarItem.type} ${calendarItem.localTime ? 'at ' + calendarItem.localTime + ' ' : ''} on ${calendarItem.localDate}**: ${calendarItem.description}\n`;
            }
          }
        } else {
          billText += '**Status:** Ignored';
        }
        embed.addField(`${parser.state(bill.state)} ${bill.number}`, billText);
        index += 1;
        text += billText.length;
        fields += 1;
      }

      embed.setTimestamp().setFooter(`${fields} ${fields === 1 ? 'bill' : 'bills'}`);
      const sentMessage = await channel.send(embed);

      if (index < bills.length) {
        await sentMessage.react('⬇️');
        try {
          await sentMessage.awaitReactions((reaction, user) => reaction.emoji.name === '⬇️' && user.id !== client.user.id, { max: 1, time: 60000, errors: ['time'] });
        } catch (err) {
          return;
        }
      }
      fields = 0;
      page += 1;
      text = 0;
    }
  } else {
    let block = '';
    for (const bill of bills) {
      if (block.length > 500) {
        // Discord only supports 2000 max, so split into multiple messages
        await channel.send(block);
        block = '';
      }
      const recentHistoryItem = parser.recentHistory(bill);
      block += `**${parser.state(bill.state)} ${bill.number}**: *${parser.title(bill)}* ${recentHistoryItem.action} as of \`${this.date(recentHistoryItem.timestamp)}\` (<${bill.url}>)\n`;
    }
    await channel.send(block);
  }
};

exports.date = function(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US');
};

exports.duration = function(timestamp) {
  const totalMillis = timestamp - Date.now();
  const totalSeconds = Math.abs(totalMillis / 1000);
  const totalMinutes = totalSeconds / 60;
  const totalHours = totalMinutes / 60;
  const totalDays = totalHours / 60;
  const totalYears = totalDays / 365;

  const seconds = Math.round(totalSeconds);
  const minutes = Math.round(totalMinutes);
  const hours = Math.round(totalHours);
  const days = Math.round(totalDays);
  const years = Math.round(totalYears);

  let durationValue;

  if (years === 0) {
    if (days === 0) {
      if (hours === 0) {
        if (minutes === 0) {
          if (seconds === 1) {
            durationValue = '1 second';
          } else {
            durationValue = `${seconds} seconds`;
          }
        } else if (minutes === 1) {
          durationValue = '1 minute';
        } else {
          durationValue = `${minutes} minutes`;
        }
      } else if (hours === 1) {
        durationValue = '1 hour';
      } else {
        durationValue = `${hours} hours`;
      }
    } else if (days === 1) {
      durationValue = '1 day';
    } else {
      durationValue = `${days} days`;
    }
  } else if (years === 1) {
    durationValue = '1 year';
  } else {
    durationValue = `${years} years`;
  }

  return `${durationValue} ${totalMillis < 0 ? 'ago' : 'from now'}`;
};

exports.toggle = function(bool) {
  return bool ? 'on' : 'off';
};
