document.addEventListener('DOMContentLoaded', (e) => {
    document
        .getElementsByClassName('btn-pay')[0]
        .addEventListener('click', makePayment);
});

function makePayment() {
    // Проверяем, поддерживается ли PR API в браузере
    if (!window.PaymentRequest) {
        document
            .getElementById('status')
            .innerHTML = "Oooops, Payment Request API не поддерживается на этом браузере";

        // Если API не поддерживается, в "продовой" версии нужно показывать традиционную форму заказа

        return;
    }

    // Теперь самое интересное
    var methodData = [
        {
            supportedMethods: ['basic-card'], // карты
            data: { // дополнительные детали
                supportedNetworks: [ // "бренды" поддерживаемых карт
                    'visa', 'mastercard', 'unionpay'
                ],
                supportedTypes: [ // типы поддерживаемых карт
                    'debit', 'credit'
                ]
            }
        }
    ];

    //Set some details
    var details = {
        total: {
            label: 'ДММ мерч',
            amount: {
                currency: 'RUB',
                value: '950.00'
            }
        },
        displayItems: [
            {
                label: '1 x Футболка dmm',
                amount: {
                    currency: 'RUB',
                    value: '650.00'
                }
            },
            {
                label: '1 x Носки dmm',
                amount: {
                    currency: 'RUB',
                    value: '300'
                }
            }
        ],
        // Удалите параметры доставки из деталей, если вы хотите,
        // чтобы событие изменения адреса доставки (shippingaddresschange) сработало
        shippingOptiыons: [
            {
                id: 'standard',
                label: 'Standard shipping',
                amount: {
                    currency: 'RUB',
                    value: '50.00'
                },
                selected: true
            },
            {
                id: 'express',
                label: 'Express shipping',
                amount: {
                    currency: 'RUB',
                    value: '150.00'
                }
            }
        ]
    };

    //Set some options
    var options = {
        requestShipping: true,
        requestPayerEmail: true,
        requestPayerPhone: true
    };

    // Теперь пришло время построить объект запроса
    var paymentRequest = new PaymentRequest(methodData, details, options);

    //Handle shipping address choice
    paymentRequest.addEventListener("shippingaddresschange", changeEvent => {
        changeEvent.updateWith(new Promise((resolve, reject) => {
            handleAddressChange(details, paymentRequest.shippingAddress, resolve, reject);
        }));
    });

    //Handle shipping options choice
    paymentRequest.addEventListener("shippingoptionchange", changeEvent => {
        changeEvent.updateWith(new Promise((resolve, reject) => {
            handleOptionChange(details, paymentRequest.shippingOption, resolve, reject);
        }));
    });

    // request.show() покажет пользователю пользовательский интерфейс запроса на оплату,
    // и пользователь может добавить или изменить детали,
    // и в конечном итоге принять или отклонить платеж
    paymentRequest
        .show()
        .then(paymentResponse => {
            var paymentInfo = {
                methodName: paymentResponse.methodName,
                details:    paymentResponse.details
            }

            // Берем данные и отправляем их на платежный шлюз
            // Смоделированная страница будет всегда возвращать 200 ОК

            var params = {
                body: JSON.stringify(paymentInfo),
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST'
            };

            console.info('params', params);

            return fetch('process-payment', params)
                .then(response => {
                    // paymentResponse.complete() используется для закрытия
                    // пользовательского интерфейса запроса на оплату
                    console.info('response-response', response);
                    if(response.status === 200) {
                        return paymentResponse.complete('success');
                    }

                    return paymentResponse.complete('fail');
                })
                .then(() => {
                    document.getElementById('status').innerHTML = 'Заказ выполнен!';
                })
                // Ловим неожиданные ошибки
                .catch((err) => {
                    return paymentResponse.complete('fail');
                });

        })
        .catch(err => {
            document.getElementById('status').innerHTML = 'Oooops, не удалось завершить покупку(((';
        });
    }

function handleAddressChange(details, shippingAddress, resolve, reject) {
    // Определяем 2 варианта доставки для российских адресов,
    // 2 варианта для остального мира
    // никаких вариантов для Австралии.

    let shippingStandard = {};
    let shippingExpress = {};
    let unsupportedAddress = false;

    switch (shippingAddress.country) {
        case 'RU': {
            shippingStandard = {
                id: 'RU Standard',
                label: 'Standard shipping Russia',
                amount: {
                    currency: 'RUB',
                    value: '50.00'
                },
                selected: true
            };

            shippingExpress = {
                id: 'RU Express',
                label: 'Express shipping Russia',
                amount: {
                    currency: 'RUB',
                    value: '250.00'
                },
                selected: false
            };
        }
            break;

        case 'AU': {
            unsupportedAddress = true;
        }
            break;

        default: {
            shippingStandard = {
                id: 'International Standard',
                label: 'Standard shipping International',
                amount: {
                    currency: 'RUB',
                    value: '150.00'
                },
                selected: true
            };

            shippingExpress = {
                id: 'International Express',
                label: 'Express shipping International',
                amount: {
                    currency: 'RUB',
                    value: '450.00'
                },
                selected: false
            };
        }
    }

    // Затем мы устанавливаем стандартную доставку по умолчанию
    if (unsupportedAddress) {
        details.shippingOptions =[];
    } else {
        details.shippingOptions = [shippingStandard, shippingExpress];

        // обновляем сводку заказа
        details.displayItems.splice(1, 1, shippingStandard);
        details = updateDetails(details);
    }

    resolve(details);
}

function handleOptionChange(details, shippingOption, resolve, reject) {
    //remove tax & shipping from our display items

    console.info('etails.displayItems-details.displayItems', details.displayItems);

    while(details.displayItems.length>1) details.displayItems.pop();



    //Match the shipping option
    for(var i=0;i<details.shippingOptions.length;i++) {
        if(shippingOption === details.shippingOptions[i].id) {
            details.shippingOptions[i].selected = true;
            details.displayItems.push(details.shippingOptions[i]);
        } else {
            details.shippingOptions[i].selected = false;
        }
    }

    details = updateDetails(details);

    resolve(details);
}

function updateDetails(details) {
    console.info('details-details', details);

    // Удалить последний элемент отображения (налог)
    if(details.displayItems.length>2) details.displayItems.pop();

    // Обновить сводку заказа, пересчитать итоги
    var tax = calculateTax(details.displayItems, 20);

    // Отображение нового значения налога
    details.displayItems.push({
        label: "НДС 20%",
        amount: {
            currency: "RUB",
            value: tax
        }
    });

    // Отображение нового итога
    details.total.amount.value = calculateTotal(details.displayItems);

    return details;
}


function calculateTax(items, rate) {
    const total = items.reduce((acc, item) => {
        if (item.amount.label !== 'VAT 20%') {
            acc += Number(item.amount.value);
        }

        return acc;
    }, 0);

    return (total * rate / 100).toFixed(2);
}

function calculateTotal(items) {
    return items
        .reduce((acc, item) => {
            acc += Number(item.amount.value);

            return acc;
        }, 0)
        .toFixed(2);
}
